import { Enum } from '../constants/Map';

export default {
    changeZoom : function(newZoom) {
        return function(dispatch) {
            dispatch({
                type: Enum.ZoomChanged,
                payload: newZoom
            })
        }
    },

    toggleFullscreen : function(fullscreenStatus) {
        return function(dispatch) {
            dispatch({
                type: Enum.SizeChanged,
                payload: fullscreenStatus
            })
        }
    },

    toggleDims : function(newDimensions) {
        return function(dispatch) {
            dispatch({
                type: Enum.DimsChanged,
                payload: {
                    width: newDimensions.width,
                    height: newDimensions.height
                }
            })
        }
    },

    toggleFlat : function(newFlatMode) {
        return function(dispatch) {
            dispatch({
                type: Enum.ModeChanged,
                payload: newFlatMode
            })
        }
    },

    toggleGrid : function(newGridState) {
        return function(dispatch) {
            dispatch({
                type: Enum.GridChanged,
                payload: newGridState
            })
        }
    },

    toggleRect : function(newRectState) {
        return function(dispatch) {
            dispatch({
                type: Enum.RectChanged,
                payload: newRectState
            })
        }
    },

    togglePoly : function(newPolyState) {
        return function(dispatch) {
            dispatch({
                type: Enum.PolyChanged,
                payload: newPolyState
            })
        }
    },

    toggleRound : function(newRoundState) {
        return function(dispatch) {
            dispatch({
                type: Enum.RoundChanged,
                payload: newRoundState
            })
        }
    },

    toggleFlush : function() {
        return function(dispatch) {
            dispatch({
                type: Enum.FlushTools,
                payload: true
            })
        }
    },

    pushGeolines : function(geolines) {
        return function(dispatch) {
            dispatch({
                type: Enum.PushGeolines,
                payload: geolines
            })
        }
    },

    clearGeolines : function() {
        return function(dispatch) {
            dispatch({
                type: Enum.FlushGeolines,
                payload: true
            })
        }
    },

    // TODO: refactor
    updateTotal : function(total) {
        return function(dispatch) {
            dispatch({
                type: Enum.UpdateTotal,
                payload: total
            })
        }
    },

    updateLoaded: function(loaded) {
        return function(dispatch) {
            dispatch({
                type: Enum.UpdateLoaded,
                payload: loaded
            })
        }
    },

    magGridRequest : function() {
      return function(dispatch) {
          dispatch({
              type: Enum.MagGridRequested,
              payload: true
          })
      }
    },

    magGridUpdate : function(magData) {
      return function(dispatch) {
          dispatch({
              type: Enum.MagGridReady,
              payload: magData
          })
      }
    },

    magGridRemove : function() {
      return function(dispatch) {
          dispatch({
              type: Enum.MagGridRemove,
              payload: true
          })
      }
    }
};
