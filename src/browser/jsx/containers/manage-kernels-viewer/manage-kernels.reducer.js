/**
 *
 * Modals work on a stack.  A modal that triggers another modal is stacking on top, such that cancelling the top modal
 * returns to the first.
 * @module
 */

import _ from 'lodash';
import cid from '../../services/cid';
import Immutable from 'seamless-immutable';
import mapReducers from '../../services/map-reducers';
import definitions from './definitions.yml';
import errorService from '../../services/errors';
import {local} from '../../services/store';
import reduxUtil from '../../services/redux-util';
import immutableUtil from '../../services/immutable-util';

const prefix = reduxUtil.fromFilenameToPrefix(__filename),
  storageKey = 'manageConnections',
  initialState = Immutable({
    list: local.get(storageKey) || []
  });

function selectConnection(state, action) {
  return state.set('active', action.payload);
}

function addChange(state, action) {
  const change = action.payload,
    itemIndex = _.findIndex(state.list, {id: change.id});

  if (itemIndex > -1) {
    state = state.setIn(['list', itemIndex, change.key], change.value);
    local.set(storageKey, state.list);
  }

  return state;
}

function removeConnection(state, action) {
  const itemIndex = _.findIndex(state.list, {id: action.payload});

  if (itemIndex > -1) {
    state = clearErrors(state);
    state = immutableUtil.removeAtPath(state, ['list'], itemIndex);

    if (state.list[itemIndex]) {
      state = state.set('active', state.list[itemIndex].id);
    } else if (state.list[itemIndex - 1]) {
      state = state.set('active', state.list[itemIndex - 1].id);
    } else {
      state = state.without('active');
    }
  }

  return state;
}

function addConnection(state) {
  const id = cid(),
    type = definitions.defaultType,
    closeable = true;

  state = clearErrors(state);
  state = immutableUtil.pushAtPath(state, ['list'], {id, type, closeable});
  state = state.set('active', id);

  return state;
}

function setErrors(state, action) {
  const error = action.payload;

  if (error && error.message) {
    state = state.set('errors', [errorService.toObject(error)]);
  }

  return state;
}

function connected(state, action) {
  if (action.error) {
    return setErrors(state, action);
  }

  state = clearErrors(state);

  return state.set('connected', action.payload.id);
}

function disconnected(state, action) {
  if (action.error) {
    return setErrors(state, action);
  }

  state = clearErrors(state);

  return state.without('connected');
}

function clearErrors(state) {
  if (state.errors) {
    state = state.without('errors');
  }

  return state;
}

function jupyterResponse(state, action) {
  const source = action.payload.source;

  /*
    Example Spec:
    {
      "control_port": 50160,
      "shell_port": 57503,
      "transport": "tcp",
      "signature_scheme": "hmac-sha256",
      "stdin_port": 52597,
      "hb_port": 42540,
      "ip": "127.0.0.1",
      "iopub_port": 40885,
      "key": "a0436f6c-1916-498b-8eb9-e81ab9368e84"
    }

    Bind to this location with ZeroMQ, i.e.,  tcp://127.0.0.1:57503.  New ports are chosen at random for each
    kernel started, signature_scheme and key are used to cryptographically sign messages

   Example kernel.json
   {
     "argv": ["python3", "-m", "IPython.kernel",
     "-f", "{connection_file}"],
     "display_name": "Python 3",
     "language": "python"
   }
   */

  if (source === 'kernelSpecManager') {
    console.log('ManageKernelsViewer', action.payload);
  }

  return state;
}

export default mapReducers(_.assign(reduxUtil.addPrefixToKeys(prefix, {
  ADD_CHANGE: addChange,
  ADD_CONNECTION: addConnection,
  REMOVE_CONNECTION: removeConnection,
  SELECT_CONNECTION: selectConnection
}), {
  JUPYTER_RESPONSE: jupyterResponse
}), initialState);
