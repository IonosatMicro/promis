import React, { Component } from 'react';
import { Form, Button, Glyphicon, ButtonGroup } from 'react-bootstrap';
import ReactSpinner from 'react-spinjs';
import Tooltip from './Tooltip';
import Quicklook from './Quicklook';
import { strings, getCurrentLanguage } from "../localizations/localization";

/* TODO: do you need these shared anywhere? */
function UnixToISO(unix_ts) {
    return new Date(unix_ts * 1e3).toISOString();
}

function UnixToAlmostISO(unix_ts) {
    let iso_ts = UnixToISO(unix_ts);
    let time_display = iso_ts.replace("T", " ").substr(0, 19);
    return time_display;
}

class DataSection extends Component {
    constructor(props) {
        super(props);

        this.state = {
            data : [],
            desc: '',
            quicklookStatus: false
        };

        this.fetchData = this.fetchData.bind(this);
        this.downloadResult = this.downloadResult.bind(this);
        this.closeQuicklook = this.closeQuicklook.bind(this);
        this.showQuicklook = this.showQuicklook.bind(this);
    }

    fetchData() {
        let lang = getCurrentLanguage();
        let mid = this.props.mid;

        if(mid) {
            let src  = '&source=' + this.props.source;
            let time = '&time_start=' + this.props.timelapse.start;
            time    += '&time_end=' + this.props.timelapse.end;
            this.props.actions.getSingle('/' + lang + '/api/download/' + mid + '/quicklook?points=100' + src + time, {}, function(resp) {
                this.setState(function() {
                    return {
                        main: resp.source.name,
                        data: resp.data,
                        desc: resp.source.description,
                        time: resp.timelapse,
                        ylab: resp.value.name,
                        unit: resp.value.units
                    }
                })
            }.bind(this))
        }
    }

    /* only ascii for now */
    downloadResult() {
        let lang = getCurrentLanguage()
        if(this.props.mid) {
            let a = document.createElement('a');
            let src  = '&source=' + this.props.source;
            let time = '&time_start=' + this.props.timelapse.start;
            time    += '&time_end=' + this.props.timelapse.end;

            a.download = this.state.main + '.txt';
            a.href = '/' + lang + '/api/download/' + this.props.mid + '/data/?format=txt' + src + time;
            a.click();
        }
        // http://localhost:8081/en/api/download/29/data/?format=ascii&source=parameter
    }

    showQuicklook() {
        this.fetchData(this.props.mid);
        this.setState(function() {
            return {
                quicklookStatus: true
            }
        })
    }

    closeQuicklook() {
        this.setState(function() {
            return {
                quicklookStatus: false
            }
        })
    }

    render() {
        return (
            <div>
            <ButtonGroup>
                <Tooltip text = {strings.tooltipQuicklook}>
                    <Button onClick = {this.showQuicklook} bsSize = 'small'>
                        { this.state.quicklookStatus == true && !this.state.data.length ? (<ReactSpinner config = { {scale: 0.65} }/>) : (null) }
                        <Glyphicon glyph = 'stats' />
                    </Button>
                </Tooltip>
                <Tooltip text = {strings.tooltipDownload}>
                    <Button onClick = {this.downloadResult} bsSize = 'small'>
                        <Glyphicon glyph = 'download-alt' />
                    </Button>
                </Tooltip>
            </ButtonGroup>
                { this.state.data.length ?
                (<Quicklook
                    data = {this.state.data}
                    title = {this.state.desc}
                    timelapse = {UnixToISO(this.state.time.start) + " – " + UnixToISO(this.state.time.end)}
                    ylabel = {this.state.ylab + " (" + this.state.unit + ")"}
                    onClose = {this.closeQuicklook}
                    show = {this.state.quicklookStatus}
                    time = {this.state.time}
                />)
                : (null)
                }
            </div>
        )
    }
}

export default class SearchResults extends Component {
    constructor(props) {
        super(props);
    }

    componentDidUpdate() {
        /* TODO: this is not the right spot REFACTOR this whole thing */
        /* check if we have a results list */
        var results = this.props.results;

        if(!this.props.results.fetch && Array.isArray(results.data) && results.data.length > 0 && this.props.map.total === 0) {
            let total = results.data.length;

            this.props.mapped.updateTotal(total);

            /* step function, requests a session, updates loaded count, updates display
             * and requests another one
             * this results in slightly slower loading, but more responsive user experience
             * TODO: make sure we handle error conditions correctly too
             */

            let index = 0;
            let geolines = [];
            function step_func(data) {
                /* null parameter means first run */
                if(data!=null) {
                    geolines.push({
                        geo_line: data.geo_line,
                        selection: results.data[index].selection,
                        offset: data.timelapse.start});

                    /* update progress bar */
                    index ++;
                    this.props.mapped.updateLoaded(index);

                    /* update display */
                    this.props.mapped.pushGeolines(geolines);
                }

                /* if the list is not exhausted, ask a new session */
                this.props.actions.getSingle(results.data[index].session, null, step_func);
            }

            step_func = step_func.bind(this);

            /* ready, steady, go! */
            step_func(null);
        }
    }

    render() {
        var results = this.props.results;

        if(this.props.results.fetch) {
            return (<ReactSpinner/>);
        } else {
            if(Array.isArray(results.data) && results.data.length > 0) {
                let channels = this.props.options.useChannels;

                return (
                    <div>
                    <span>{strings.found} {results.data.length} {strings.results}</span>
                    <table className = 'table table-hover'>
                        <thead>
                            <tr>
                                <th>{strings.datetimeFrom}</th>
                                <th>{ channels ? strings.channel : strings.parameter }</th>
                                <th>{strings.dataSize}</th>
                                <th>{strings.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            { results.data.map(function(measurement, index) {
                                let mid = measurement.id;

                                let session = this.props.storage.sessions.data.find(function(s) {
                                    return s.url === measurement.session;
                                });

                                let storage = (channels ?
                                    this.props.storage.channels.data :
                                    this.props.storage.parameters.data);

                                let data = storage.find(function(d) {
                                    return (channels ? (d.url === measurement.channel) : (d.url === measurement.parameter));
                                });

                                let size = strings.sizeUnknown;

                                /* each measurement may have multiple parts defined by the selection array */
                                return measurement.selection.map(function(selection, index) {
                                    return (
                                        <tr key = {index}>
                                            <td>{UnixToAlmostISO(selection.start)}</td>
                                            <td>{data.name}</td>
                                            <td>{size}</td>
                                            <td>
                                                <DataSection
                                                    mid = {mid}
                                                    actions = {this.props.actions}
                                                    source = {(channels ? 'channel' : 'parameter')}
                                                    timelapse = { selection }
                                                />
                                            </td>
                                        </tr>
                                    )
                                }.bind(this));
                            }.bind(this))
                            }
                        </tbody>
                    </table>
                    </div>
                )
            } else {
                return (
                    <span>{strings.notFound}</span>
                )
            }
        }
    }
}
