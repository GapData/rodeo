import _ from 'lodash';
import api from '../../services/api';
import clientDiscovery from '../../services/jupyter/client-discovery';
import preferenceActions from '../../actions/preferences';
import errors from '../../services/errors';
import reduxUtil from '../../services/redux-util';

const prefix = reduxUtil.fromFilenameToPrefix(__filename);

/**
 * @returns {function}
 */
function save() {
  return function (dispatch, getState) {
    const preferences = getState().preferences;

    // only save if there are no invalid entries
    if (preferences.canSave) {
      dispatch(preferenceActions.savePreferenceChanges(preferences.changes));
    }
  };
}

function markChangeInvalid(change) {
  return function (error) {
    change.state = 'invalid';
    change.errors = [error];
  };
}

function dispatchChangeDetail(change, dispatch) {
  const actionType = 'PREFERENCE_CHANGE_DETAIL_ADDED';

  return function () {
    if (change.errors) {
      change.errors = _.map(change.errors, errors.toObject);
    }

    dispatch({type: actionType, change, meta: {sender: 'self'}});
  };
}

/**
 * @param {{key: string, value: string, type: string}} change
 * @returns {function}
 */
function add(change) {
  return function (dispatch) {
    if (change.type === 'pythonCmd') {
      // check the kernel that command points to
      change.state = 'validating';
      clientDiscovery.checkKernel({cmd: change.value})
        .then(function (result) {
          const errors = _.get(result, 'errors');

          if (errors && errors.length) {
            change.errors = errors;
            change.state = 'invalid';
          } else {
            change.state = 'valid';
          }

          change.checkKernel = result;
        }).catch(markChangeInvalid(change))
        .then(dispatchChangeDetail(change, dispatch));
    } else if (change.type === 'folder') {
      // check the kernel that command points to
      change.state = 'validating';
      api.send('fileStats', change.value).then(function (result) {
        if (result.isDirectory) {
          change.state = 'valid';
          change.fileStats = result;
        } else {
          change.errors = [new Error('Not a directory')];
          change.state = 'invalid';
        }
      }).catch(markChangeInvalid(change))
        .then(dispatchChangeDetail(change, dispatch));
    } else if (change.type === 'environmentVariableList') {
      change.state = 'validating';
      api.send('getEnvironmentVariables')
        .then(result => {
          if (result) {
            change.state = 'valid';
            change.value = result;
          } else {
            change.errors = [new Error('Not a directory')];
            change.state = 'invalid';
          }
        }).catch(markChangeInvalid(change))
          // not just a detail
          .then(() => dispatch({type: 'PREFERENCE_CHANGE_ADDED', change, meta: {sender: 'self'}}));
    } else {
      change.state = 'valid';
    }

    // immediate feedback, because typing can be fast
    return dispatch({type: 'PREFERENCE_CHANGE_ADDED', change, meta: {sender: 'self'}});
  };
}

function selectFile(change) {
  return function (dispatch) {
    return api.send('openDialog', {
      properties: ['openFile']
    }).then(function (fileList) {
      change = _.clone(change);
      change.value = _.head(fileList);
      return dispatch(add(change));
    }).catch(error => console.error(error));
  };
}

function selectFolder(change) {
  return function (dispatch) {
    return api.send('openDialog', {
      properties: ['openDirectory']
    }).then(function (fileList) {
      change = _.clone(change);
      change.value = _.head(fileList);
      return dispatch(add(change));
    }).catch(error => console.error(error));
  };
}

/**
 *
 * @param {string} active
 * @returns {function}
 */
function selectTab(active) {
  return function (dispatch, getState) {
    const preferences = getState().preferences;

    if (_.size(preferences.changes) === 0) {
      dispatch({type: 'PREFERENCE_ACTIVE_TAB_CHANGED', active, meta: {sender: 'self'}});
    }
  };
}

/**
 * @returns {{type: string}}
 */
function cancelAll() {
  return {type: 'PREFERENCE_CANCEL_ALL_CHANGES', meta: {sender: 'self'}};
}

function manageConnections() {
  return {type: 'ADD_MODAL_DIALOG', contentType: 'MANAGE_CONNECTIONS', title: 'Manage Connections', meta: {sender: 'self'}};
}

function addFromListContainer(item, container) {
  return {type: prefix + 'ADD_FROM_LIST_CONTAINER', payload: {item, container}, meta: {sender: 'self'}};
}

function addListContainer(item, container) {
  return {type: prefix + 'ADD_LIST_CONTAINER', payload: {item, container}, meta: {sender: 'self'}};
}

function cancelListContainer(payload) {
  return {type: prefix + 'CANCEL_LIST_CONTAINER', payload, meta: {sender: 'self'}};
}

function changeContainerValue(payload) {
  return {type: prefix + 'CHANGE_CONTAINER_VALUE', payload, meta: {sender: 'self'}};
}

function removeFromList(item, key) {
  return {type: prefix + 'REMOVE_FROM_LIST', payload: {item, key}, meta: {sender: 'self'}};
}

export default {
  add,
  addListContainer,
  addFromListContainer,
  cancelAll,
  cancelListContainer,
  changeContainerValue,
  removeFromList,
  save,
  selectFile,
  selectFolder,
  selectTab,
  manageConnections
};
