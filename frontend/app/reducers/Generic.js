import { Enum, State } from '../constants/Generic';

export default function GenericReducer(state = State, action) {
    let query = state.query;
    let polygon = state.polygon;
    let altitude = state.altitude;
    let timelapse = state.timelapse;

    if(! Array.isArray(query.channels)) {
        query.channels = new Array();
    }

    if(! Array.isArray(query.parameters)) {
        query.parameters = new Array();
    }

    if(! Array.isArray(query.devices)) {
        query.devices = new Array();
    }

    switch(action.type) {
        /* map/manual input mode */
        case Enum.SelectionModeChanged:
            return Object.assign({}, state, { useMap: action.payload });
        break;

        /* timelapse */
        case Enum.DateFromChanged:
            timelapse.begin = action.payload;

            return Object.assign({}, state, { timelapse : timelapse });
        break;

        case Enum.DateToChanged:
            timelapse.end = action.payload;

            return Object.assign({}, state, { timelapse : timelapse });
        break;

        /* manual polygon */
        case Enum.LatFromChanged:
            polygon.begin[0] = action.payload;

            return Object.assign({}, state, { polygon : polygon });
        break;

        case Enum.LatToChanged:
            polygon.end[0] = action.payload;

            return Object.assign({}, state, { polygon : polygon });
        break;

        case Enum.LngFromChanged:
            polygon.begin[1] = action.payload;

            return Object.assign({}, state, { polygon : polygon });
        break;

        case Enum.LngToChanged:
            polygon.end[1] = action.payload;

            return Object.assign({}, state, { polygon : polygon });
        break;

        /* altitude */
        case Enum.AltFromChanged:
            altitude.begin = action.payload;

            return Object.assign({}, state, { altitude : altitude });
        break;

        case Enum.AltToChanged:
            altitude.end = action.payload;

            return Object.assign({}, state, { altitude : altitude });
        break;


        /* query handling */
        case Enum.QuerySetProject:
            query.project = action.payload;

            return Object.assign({}, state, {
                query: query
            });
        break;

        case Enum.QuerySetDevice:
            query.devices.push(action.payload);

            return Object.assign({}, state, {
                query: query
            });
        break;

        case Enum.QuerySetChannel:
            query.channels.push(action.payload);

            return Object.assign({}, state, {
                query: query
            });
        break;

        case Enum.QueryClearChannel:
            query.channels = query.channels.filter(function(e) { return e !== action.payload });

            return Object.assign({}, state, {
                query: query
            });
        break;

        case Enum.QuerySetParameter:
            query.parameters.push(action.payload);

            return Object.assign({}, state, {
                query: query
            });
        break;

        case Enum.QueryClearParameter:
            query.parameters = query.parameters.filter(function(e) { return e !== action.payload });

            return Object.assign({}, state, {
                query: query
            });
        break;

        default:
            return state;
        break;
    }
}
