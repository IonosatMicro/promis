import React, { Component } from 'react';

import CesiumContainer from './CesiumMap';
import LeafletContainer from './LeafletMap';
import MapZoomBox from './MapZoomBox';
import MapToolbox from './MapToolBox';
import Panel from './Panel';

export default class UniversalMap extends Component {
    constructor(props) {
        super(props);

        this.precision = 3;       /* fixed point precision */
        this.circleSegments = 18; /* number of polygon vertices to transform circle to */

        /* bind this */
        this.preview = this.preview.bind(this);
        this.fixedPoint = this.fixedPoint.bind(this);
        this.getSelection = this.getSelection.bind(this);
        this.getLastPoint = this.getLastPoint.bind(this);
        this.determineStyle = this.determineStyle.bind(this);
        this.getCurrentType = this.getCurrentType.bind(this);
        this.getCurrentIndex = this.getCurrentIndex.bind(this);

        /* make local copy of selection actions */
        this.selectionActions = this.props.selectionActions;

        /* and extend that copy */
        this.selectionActions.fixedPoint = this.fixedPoint;
        this.selectionActions.getLastPoint = this.getLastPoint;
        this.selectionActions.getSelection = this.getSelection;
        this.selectionActions.getCurrentType = this.getCurrentType;
        this.selectionActions.getCurrentData = this.getCurrentData;
        this.selectionActions.getCurrentIndex = this.getCurrentIndex;
    }

    /* next selection point coordinates callback */
    preview(data) {
        this.props.ee.emit('nextPoint', data);
    }

    /* make fixed point number from floating point one */
    fixedPoint(number) {
        return parseFloat(number.toFixed(this.precision));
    }

    /* get (current) selection item */
    getSelection(i) {
        let index = (i !== undefined ? i : this.props.selection.current);

        return this.props.selection.elements[index];
    }

    /* get current selection index */
    getCurrentIndex() {
        return this.props.selection.current;
    }

    /* get current selection type */
    getCurrentType() {
        let selection = this.getSelection();

        return selection.type;
    }

    /* get current selection data */
    getCurrentData() {
        let selection = this.getSelection();

        return selection.data;
    }

    /* get last point from current selection */
    getLastPoint() {
        let data = this.getSelection().data.slice(0);

        return data.pop();
    }

    /* adjust container style for fullscreen */
    determineStyle(options) {
        let styles = {
            position: 'relative'
        };

        if(this.props.options.full) {
            styles.display = 'block';
            styles.zIndex = 9999;
            styles.position = 'fixed';
            styles.top = 0;
            styles.right = 0;
            styles.left = 0;
            styles.bottom = 0;
            styles.overflow = 'auto';
            styles.width = options.dims.width;
            styles.height = options.dims.height;
        }

        return styles;
    }

    render() {
        let geo = this.props.geolines;
        let map = this.props.mapActions;
        let sel = this.selectionActions;
        let options = this.props.options;
        let selection = this.props.selection;
        let mapStyles = this.determineStyle(options);

        return (
            <Panel disableDrag = {options.full} title = 'Map' className = 'mapPanel'>
                <div style = {mapStyles}>
                    <div className = 'mapContainer'>
                        <MapZoomBox onChange = {map.changeZoom} defaultZoom = {options.defaultZoom} />
                        <MapToolbox onSelect = {sel} onChange = {map} options = {options} hasSelection = {selection.current > 0} />
                        { options.flat ? (
                        <LeafletContainer
                            onPreview = {this.preview}
                            onChange = {map}
                            onSelect = {sel}
                            options = {options}
                            geolines = {geo}
                            selection = {selection}
                        />
                        ) : (
                        <CesiumContainer
                            onPreview = {this.preview}
                            onChange = {map}
                            onSelect = {sel}
                            options = {options}
                            geolines = {geo}
                            selection = {selection}
                        />
                        ) }
                    </div>
                </div>
            </Panel>
        );
    }
}
