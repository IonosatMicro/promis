import React, { Component } from 'react';
import { ButtonGroup } from 'react-bootstrap';

import ToolboxButton from './ToolboxButton';
import GridButton from './GridButton';

import { Types } from '../constants/Selection';
import { GridTypes } from '../constants/Map';

export default class MapToolBox extends Component {
    constructor(props) {
        super(props);

        this.select = props.onSelect;
        this.actions = props.onChange;

        /* more this please... */
        this.toggleFlat = this.toggleFlat.bind(this);
        this.toggleFull = this.toggleFull.bind(this);
        this.toggleGrid = this.toggleGrid.bind(this);
        this.toggleRect = this.toggleRect.bind(this);
        this.togglePoly = this.togglePoly.bind(this);
        this.toggleFlush = this.toggleFlush.bind(this);
        this.toggleRound = this.toggleRound.bind(this);
        this.toggleClean = this.toggleClean.bind(this);
        this.toggleSelect = this.toggleSelect.bind(this);
    }

    toggleSelect(currentState) {
        if(currentState) {
            this.select.startSelection();
        } else {
            this.select.finishSelection();
        }
    }

    toggleFlush() {
        this.actions.toggleFlush();
        this.select.finishSelection();
    }

    toggleFlat() {
        this.toggleFlush();
        this.actions.toggleFlat(! this.props.options.flat);
    }

    toggleFull() {
        this.actions.toggleFullscreen(! this.props.options.full);
    }

    toggleGrid() {
        this.actions.toggleGrid(! this.props.options.grid);
    }

    toggleClean() {
        this.toggleFlush();
        this.select.clearSelection();
    }

    /* TODO: update tools to use local toggleFlush */

    /* just tool */
    togglePoly(polyState) {
        this.toggleSelect(polyState);
        this.actions.togglePoly(polyState);

        if(polyState) {
            this.select.setType(Types.Polygon);
        }
    }

    /* related tool */
    toggleRect(rectState) {
        if(this.props.options.round) {
            this.toggleSelect(false);
            this.actions.toggleRound(false);
        }

        this.toggleSelect(rectState);
        this.actions.toggleRect(rectState);

        if(rectState) {
            this.select.setType(Types.Rect);
        }
    }

    /* related tool */
    toggleRound(roundState) {
        if(this.props.options.rect) {
            this.toggleRect(false);
        }

        this.toggleSelect(roundState);
        this.actions.toggleRound(roundState);

        if(roundState) {
            this.select.setType(Types.Circle);
        }
    }

    // <ToolboxButton key = {1} icon = 'erase' help = 'Erase last selection' />,

    render() {
        var opts = this.props.options;

        return (
            <div className = 'mapToolBox'>
                <ButtonGroup className = 'innerToolBox'>
                    <ToolboxButton onClick = {this.toggleFlat} active = {! opts.flat} icon = 'globe' help = {'Switch to ' + (opts.flat ? '3D' : '2D')} />
                    { opts.flat ? ( [
                        <ToolboxButton key = {1} onClick = {this.toggleRect.bind(null, ! opts.rect)} active = {opts.rect} icon = 'unchecked' help = 'Select rectangular area' />,
                    ]) : ([
                        <ToolboxButton key = {1} onClick = {this.togglePoly.bind(null, ! opts.poly)} active = {opts.poly} icon = 'screenshot' help = 'Select polygonal area' />
                    ]) }
                    <ToolboxButton key = {2} onClick = {this.toggleRound.bind(null, ! opts.round)} active = {opts.round} icon = 'record' help = 'Select circular area' />

                    <GridButton
                        grid = {opts.grid[GridTypes.Geographic]}
                        icon = 'th'
                        help = 'Toggle geographic grid' />
                    <GridButton
                        grid = {opts.grid[GridTypes.Inclination]}
                        icon = 'dashboard'
                        help = 'Toggle magnetic inclination grid' />
                    <GridButton
                        grid = {opts.grid[GridTypes.Intensity]}
                        icon = 'magnet'
                        help = 'Toggle magnetic intensity grid' />

                    <ToolboxButton onClick = {this.toggleFull} icon = {opts.full ? 'resize-small' : 'resize-full'} help = {opts.full ? 'Minimize' : 'Fullscreen'} />
                    { this.props.hasSelection ? ([
                        <ToolboxButton onClick = {this.toggleClean} key = {2} icon = 'ban-circle' style = 'danger' help = 'Clear all selection' />
                    ]) : ([]) }
                </ButtonGroup>
            </div>
        );
    }
}
