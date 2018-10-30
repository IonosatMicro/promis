import React, { Component } from 'react';

import { toDegrees } from 'cesium/Source/Core/Math';
import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import Color from 'cesium/Source/Core/Color';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import NearFarScalar from 'cesium/Source/Core/NearFarScalar';
import Rectangle from 'cesium/Source/Core/Rectangle';
import defined from 'cesium/Source/Core/defined';
import BingMapsApi from 'cesium/Source/Core/BingMapsApi';
import BingMapsStyle from 'cesium/Source/Scene/BingMapsStyle';
import BingMapsImageryProvider from 'cesium/Source/Scene/BingMapsImageryProvider';
import GridImageryProvider from 'cesium/Source/Scene/GridImageryProvider';
import Cartographic from 'cesium/Source/Core/Cartographic';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';

import Material from 'cesium/Source/Scene/Material';
import Primitive from 'cesium/Source/Scene/Primitive';
import CircleGeometry from 'cesium/Source/Core/CircleGeometry';
import PolygonGeometry from 'cesium/Source/Core/PolygonGeometry';
import GeometryInstance from 'cesium/Source/Core/GeometryInstance';
import EllipsoidSurfaceAppearance from 'cesium/Source/Scene/EllipsoidSurfaceAppearance';

import PolylineOutlineMaterialProperty from 'cesium/Source/DataSources/PolylineOutlineMaterialProperty';
import PolylineDashMaterialProperty from 'cesium/Source/DataSources/PolylineDashMaterialProperty';

import { BingKey, GridTypes } from '../constants/Map';
import { Types, latlngRectangle } from '../constants/Selection';
import * as MapStyle from '../constants/MapStyle';

import 'cesium/Source/Widgets/widgets.css';

export default class CesiumContainer extends Component {
    constructor(props) {
        super(props);

        /* map options */
        BingMapsApi.defaultKey = BingKey;

        this.options = {
            infoBox: false,
            timeline: false,
            geocoder: false,
            animation: false,
            homeButton: false,
            scene3DOnly: true,
            fullscreenButton: false,
            baseLayerPicker: false,
            sceneModePicker: false,
            selectionIndicator: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false
        }

        /* main handle */
        this.viewer = null;

        /* object handles */
        this.pointHandles = new Array();
        this.shapeHandles = new Array();
        this.geolineHandles = new Array();
        this.previewHandle = null;
        this.latlngHandle = null;
        this.magGridHandle = {}; window.magGridHandle = this.magGridHandle;

        /* for render suspension */
        this.lastmove = Date.now();
        this.lastmatrix = new Matrix4();

        /* shape funcs & utils */
        this.safePick = this.safePick.bind(this);
        this.makeShape = this.makeShape.bind(this);
        this.clearShape = this.clearShape.bind(this);
        this.makeGeoline = this.makeGeoline.bind(this);
        this.makeIsolines = this.makeIsolines.bind(this);
        this.previewShape = this.previewShape.bind(this);
        this.pointToRadius = this.pointToRadius.bind(this);
        this.makeSelectionPoint = this.makeSelectionPoint.bind(this);

        /* enable render on this events */
        this.eventHandler = null;
        this.renderEvents = new Array('mousemove', 'mousedown', 'mouseup', 'mousewheel', 'mouseclick', 'wheel',
                                      'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'pointerup');

        // scroll to startpos
        //this.scrollToView(startpos[0], startpos[1]);
        this.repaint = this.repaint.bind(this);
        this.updateMap = this.updateMap.bind(this);
        this.currentView = this.currentView.bind(this);
        this.currentPosition = this.currentPosition.bind(this);

        /* events */
        this.initEvents = this.initEvents.bind(this);
        this.postRender = this.postRender.bind(this);
        this.clearEvents = this.clearEvents.bind(this);
        this.justDrawEvent = this.justDrawEvent.bind(this);
        this.moveDrawEvent = this.moveDrawEvent.bind(this);
        this.stopDrawEvent = this.stopDrawEvent.bind(this);
        this.voidDrawEvent = this.voidDrawEvent.bind(this);

        /* materials */
        this.previewMaterial = Material.fromType('Stripe');
    }

    /* update only for fullscreen toggling */
    shouldComponentUpdate(nextProps) {
        return (nextProps.options.full !== this.props.options.full) ||
               (this.props.options.dims.width !== nextProps.options.dims.width ||
                this.props.options.dims.height !== nextProps.options.dims.height);
    }

    componentWillReceiveProps(nextProps) {
        this.updateMap(nextProps);
        this.repaint();
    }

    componentDidUpdate() {
        this.repaint();
    }

    componentWillUnmount() {
        this.clearEvents();

        this.map = null;
    }

    componentDidMount() {
        /* mount to div */
        if(! this.viewer) {
            this.viewer = new Viewer(this.mapNode, this.options);

            this.viewer.imageryLayers.removeAll();

            this.bing = this.viewer.imageryLayers.addImageryProvider(
                new BingMapsImageryProvider({ url : '//dev.virtualearth.net', mapStyle: BingMapsStyle.AERIAL_WITH_LABELS }));
            this.grid = this.viewer.imageryLayers.addImageryProvider(
                new GridImageryProvider());
            this.grid.alpha = 0.0;

            this.ellipsoid = this.viewer.scene.mapProjection.ellipsoid;
            this.cartographic = new Cartographic();

            /* get rid of camera inertia */
            this.viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
            this.viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
            this.viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;

            this.initEvents();
        }

        this.repaint();
        this.updateMap();
    }

    repaint() {
        if(this.viewer) {
            this.lastmove = Date.now();

            if(! this.viewer.useDefaultRenderLoop) {
                this.viewer.useDefaultRenderLoop = true;
                //console.log('render resumed @', this.lastmove);
            }
        }
    }

    currentView() {
        return this.ellipsoid.cartesianToCartographic(this.viewer.camera.positionWC, this.cartographic);
    }

    /* ensures picked point doesn't belong to any objects */
    safePick(position) {
        return true;//!defined(this.viewer.scene.pick(position));
    }

    /* to be called only when drawing */
    currentPosition(position) {
        let point = this.viewer.camera.pickEllipsoid(position);
        let coords = null;
        let carrad = null;

        if(point) {
            carrad = this.ellipsoid.cartesianToCartographic(point);
            coords = [
                        this.props.onSelect.fixedPoint(toDegrees(carrad.latitude)),
                        this.props.onSelect.fixedPoint(toDegrees(carrad.longitude))
                    ];
        }

        return { 'point' : point, 'coords' : coords }
    }

    initEvents() {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);

        /* draw events */
        this.eventHandler.setInputAction(this.justDrawEvent, ScreenSpaceEventType.LEFT_CLICK);
        this.eventHandler.setInputAction(this.moveDrawEvent, ScreenSpaceEventType.MOUSE_MOVE);
        this.eventHandler.setInputAction(this.stopDrawEvent, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        this.eventHandler.setInputAction(this.voidDrawEvent, ScreenSpaceEventType.RIGHT_CLICK);

        /* shut down render sometimes */
        this.viewer.scene.postRender.addEventListener(this.postRender);

        /* enable render back */
        this.renderEvents.forEach(function(eventname) {
            this.viewer.canvas.addEventListener(eventname, this.repaint, false);
        }.bind(this));
    }

    clearEvents() {
        this.renderEvents.forEach(function(eventname) {
            this.viewer.canvas.removeEventListener(eventname, this.repaint, false);
        }.bind(this));

        this.eventHandler = this.eventHandler && this.eventHandler.destroy();
    }

    justDrawEvent(event) {
        if(this.props.selection.active) {
            let last = this.props.onSelect.getLastPoint();
            let type = this.props.onSelect.getCurrentType();
            let position = this.currentPosition(event.position);

            if(this.safePick(event.position)) {
                if(last && type == Types.Circle) {
                    this.props.onSelect.addToSelection(this.pointToRadius(last, position.point));
                    this.props.onSelect.finishSelection();
                    this.props.onChange.toggleFlush();
                } else {
                    this.pointHandles.push(this.makeSelectionPoint(position.coords));
                    this.props.onSelect.addToSelection(position.coords);
                }
            }
        }
    }

    moveDrawEvent(event) {
        if(this.props.selection.active) {
            let position = this.currentPosition(event.startPosition);

            if(position.coords) {
                this.previewShape(position)

                if(this.props.onPreview) {
                    this.props.onPreview(position.coords);
                }
            }
        }
    }

    stopDrawEvent(event) {
        if(this.props.selection.active) {
            let position = this.currentPosition(event.position);

            if(position.coords) {
                this.props.onSelect.addToSelection(position.coords);
                this.props.onSelect.finishSelection();
                this.props.onChange.toggleFlush();
            }
        }
    }

    voidDrawEvent(event) {
        if(this.props.selection.active) {
            this.props.onSelect.discardSelection();
            this.props.onChange.toggleFlush();
        }
    }

    /* © terriaJS */
    postRender(scene, date) {
        var now = Date.now();

        if (!Matrix4.equalsEpsilon(this.lastmatrix, scene.camera.viewMatrix, 1e-5)) {
            this.lastmove = now;
        }

        var cameraMovedInLastSecond = (now - this.lastmove) < 1000;

        if(scene) {
            var surface = scene.globe._surface;
            var tilesWaiting = !surface._tileProvider.ready || surface._tileLoadQueueHigh.length > 0 || surface._tileLoadQueueMedium.length > 0 || surface._tileLoadQueueLow.length > 0 || surface._debug.tilesWaitingForChildren > 0;

            if (!cameraMovedInLastSecond && !tilesWaiting && scene.tweens.length === 0) {
                if(this.viewer.useDefaultRenderLoop) {
                    this.viewer.useDefaultRenderLoop = false;
                    //console.log('render suspended @' + now);
                }
            }
        }

        Matrix4.clone(scene.camera.viewMatrix, this.lastmatrix);
    }

    clearShape(shape) {
        if(defined(shape))
            shape.show = false; // TODO: very ugly, fix scheduled in #272
            //this.viewer.entities.remove(shape);
    }

    /* distance between latlon and cartesian */
    pointToRadius(first, second) {
        return Cartesian3.distance(Cartesian3.fromDegrees(first[1], first[0]), second);
    }

    makeShape(type, data, highlight) {
        let shape = null;
        let style = this.getStyle(highlight ? MapStyle.SelectionHighlight : MapStyle.Selection);

        /* height: 0 instructs cesium to draw on flat surface and not do terrain
         * this is needed for outlines to work correctly */

        switch(type) {
            case Types.Rect:
                /* pick the correct ranges */
                let south = Math.min(data[0][0], data[1][0]),
                    north = Math.max(data[0][0], data[1][0]);

                let west = Math.min(data[0][1], data[1][1]),
                    east = Math.max(data[0][1], data[1][1]);

                /* for rectangles spanning the Earth more than once,
                   replace with full longitude range */
                if(east - west >= 360) {
                    west = -180;
                    east = 180;
                } else { /* otherwise wrap the coordinates */
                    function wrap(d) {
                        let sgn = Math.sign(d);
                        return (d + sgn * 180) % 360 - sgn * 180;
                    }

                    west = wrap(west);
                    east = wrap(east);
                }

                console.log(west, south, east, north);
                shape = this.viewer.entities.add({
                    rectangle : {
                        coordinates : Rectangle.fromDegrees(west, south, east, north),
                        height: 0,
                        ...style
                    }
                });
            break;

            case Types.Circle:
                shape = this.viewer.entities.add({
                        position: Cartesian3.fromDegrees(data[0][1], data[0][0]),
                        ellipse: {
                            semiMajorAxis: data[1],
                            semiMinorAxis: data[1],
                            height: 0,
                            ...style
                        }
                    }
                );
            break;

            case Types.Polygon:
                let lonlat = new Array();

                data.forEach(function(latlon){
                    lonlat.push(latlon[1]);
                    lonlat.push(latlon[0]);
                });

                shape = this.viewer.entities.add({
                    polygon: {
                        hierarchy : {
                            positions : Cartesian3.fromDegreesArray(lonlat)
                        },
                        height: 0,
                        ...style
                    }
                });
            break;
        }

        return shape;
    }

    previewShape(newpoint) {
        let temp = null;
        let last = this.props.onSelect.getLastPoint();
        let type = this.props.onSelect.getCurrentType();
        let data = this.props.onSelect.getCurrentData();
        let geometry = null;

        if(last) {
            /* ensure we have valid data */
            if(! Array.isArray(data)) {
                data = new Array();
            }

            /* clear last preview */
            this.previewHandle && this.viewer.scene.primitives.remove(this.previewHandle);

            /* and make new one */
            switch(type) {
                case Types.Circle:
                    geometry = new CircleGeometry({
                        center : Cartesian3.fromDegrees(last[1], last[0]),
                        radius : this.pointToRadius(last, newpoint.point),
                        vertexFormat : EllipsoidSurfaceAppearance.VERTEX_FORMAT
                    });
                break;

                case Types.Polygon:
                    let deg = new Array();

                    data.concat(new Array(newpoint.coords)).forEach(function(latlon){
                        deg.push(latlon[1]);
                        deg.push(latlon[0]);
                    });

                    geometry = new PolygonGeometry.fromPositions({
                        positions : Cartesian3.fromDegreesArray(deg),
                        vertexFormat : EllipsoidSurfaceAppearance.VERTEX_FORMAT
                    });
                break;
            }

            this.previewHandle = new Primitive({
                geometryInstances : new GeometryInstance({
                    geometry: geometry,
                    id: new Object({})
                }),
                allowPicking : false,
                asynchronous : false,
                appearance : new EllipsoidSurfaceAppearance({
                    material : this.previewMaterial
                })
            });

            this.viewer.scene.primitives.add(this.previewHandle);
        }
    }

    makeSelectionPoint(latlon) {
        /* points seem to be styled differently, color instead of material
         * and outlines need to be 2 times thinner to match other shapes */
        let st = this.getStyle(MapStyle.SelectionHandle);
        st.color = st.material;
        st.outlineWidth /= 2;

        return this.viewer.entities.add({
            position : Cartesian3.fromDegrees(latlon[1], latlon[0]),
            point : {
                show : true,
                pixelSize : 10,
                scaleByDistance : new NearFarScalar(1.5e2, 2.0, 1.5e7, 0.5),
                ...st
            }
        });
    }

    makeIsolines(isodata) {
        let isolines = [];

        isodata.forEach(function(isoline){
            let cartesians = new Array();

            /* data is [lat, lon, hgt] */
            isoline.coords.forEach(function(point) {
                cartesians.push(Cartesian3.fromDegrees(point[1], point[0], 0));
            });


            let line = this.viewer.entities.add({
                polyline : {
                    positions : cartesians,
                    ...this.getStyle(isoline.style)
                }
            });

            isolines.push(line);
        }.bind(this));

        return isolines;
    }

    makeGeoline(data, style) {
        let cartesians = new Array();

        /* data is [lat, lon, hgt] */
        data.forEach(function(point) { // TODO temporary disabling altitude because it stores time temporarily
            cartesians.push(Cartesian3.fromDegrees(point[1], point[0], point[2] ? point[2] *1000 : 250000));
        });

        return this.viewer.entities.add({
            polyline : {
                positions : cartesians,
                ...this.getStyle(style)
            }
        });
    }

    makeRegularGrid() {
        let grid = [];
        for (let lat = -90, even = false; lat <= 90; lat+=10, even = !even) {
            /* we need to do steps on the horizonal grid because otherwise Cesium
             * draws a straight line */
            let positions = [];
            for (let lon = -180; lon <= 180; lon+=10) {
                positions.push(Cartesian3.fromDegrees(lon, lat, 0));
            }

            grid.push(this.viewer.entities.add({
                polyline : {
                    positions : positions,
                    ...this.getStyle(even ? MapStyle.GridEven : MapStyle.Grid)
                }
            }));
        }

        for (let lon = -180, even = false; lon <= 180; lon+=10, even = !even) {
            grid.push(this.viewer.entities.add({
                polyline : {
                    positions : [
                        Cartesian3.fromDegrees(lon, -90, 0),
                        Cartesian3.fromDegrees(lon, 90, 0)
                    ],
                    ...this.getStyle(even ? MapStyle.GridEven : MapStyle.Grid)
                }
            }));
        }
        return grid;
    }

    updateMap(maybeProps) {
        let props = maybeProps !== undefined ? maybeProps : this.props;

        if(! props.selection.active) {
            for (let gridkey in GridTypes) {
                let gridtype = GridTypes[gridkey];
                let grid = props.options.grid[gridtype];

                /* TODO: refactor */
                if (gridtype == GridTypes.Geographic) {
                    if (this.magGridHandle[gridtype] == null) {
                        this.magGridHandle[gridtype] = this.makeRegularGrid();
                    }
                } else {
                    if(Array.isArray(grid.data) && this.magGridHandle[gridtype] == null) {
                        this.magGridHandle[gridtype] = this.makeIsolines(grid.data);
                    } else if (grid.data == null && this.magGridHandle[gridtype] != null) {
                        this.magGridHandle[gridtype].forEach(function(handle) {
                            this.clearShape(handle);
                        }.bind(this));
                        this.magGridHandle[gridtype] = null;
                    }
                }

                /* visibility control */
                // TODO: constantly adding/removing might be excessive, general fix coming in #244
                if(this.magGridHandle[gridtype]) {
                    if(grid.visible) {
                        this.magGridHandle[gridtype].forEach(function(shape) {
                            shape.show = true;
                        }.bind(this));
                    } else {
                        this.magGridHandle[gridtype].forEach(function(shape) {
                            shape.show = false;
                        }.bind(this));
                    }
                }
            }

            /* clear preview */
            this.previewHandle && this.viewer.scene.primitives.remove(this.previewHandle);

            /* clear shapes */
            this.shapeHandles.forEach(function(handle) {
                this.clearShape(handle);
            }.bind(this));

            /* clear selection points */
            this.pointHandles.forEach(function(point) {
                this.clearShape(point);
            }.bind(this));

            /* render new selection */
            if(props.selection.current > 0) {
                this.shapeHandles = new Array();
                this.pointHandles = new Array();

                props.selection.elements.forEach(function(selection, rootIndex) {
                    if(selection.data.length) {
                        this.shapeHandles.push(this.makeShape(selection.type, selection.data, props.selection.highlight == rootIndex));

                        selection.data.every(function(point, itemIndex) {
                            this.pointHandles.push(this.makeSelectionPoint(point));
                            // point drag handler here

                            /* break if we've got a circle */
                            return selection.type != Types.Circle;
                        }.bind(this));
                    }
                }.bind(this));
            }

            /* if there is a manual input on geography filter, draw it */
            this.clearShape(this.latlngHandle);

            let latlng = latlngRectangle(props.searchOptions.rectangle);
            if(latlng) {
                // TODO: pass this.latlngMaterial
                this.latlngHandle = this.makeShape(latlng.type, latlng.data, false);
            }

            /* clear geolines */
            this.geolineHandles.forEach(function(handle) {
                this.clearShape(handle);
            }.bind(this));

            /* draw new geolines if they're present */
            if(Array.isArray(props.options.geolines) && props.options.geolines.length > 0) {
                this.geolineHandles = new Array();

                props.options.geolines.forEach(function(geoline){
                    // TODO generalise to UniversalMap
                    // TODO stub code
                    let last = 0;
                    geoline.selection.forEach(function(segment) {
                        let seg = { start: segment.start - geoline.offset,
                                    end: segment.end - geoline.offset };

                        // +1 to include seg.start and seg.end
                        if(seg.start - last > 0) {
                            this.geolineHandles.push(this.makeGeoline(geoline.geo_line.slice(last, seg.start + 1), MapStyle.SessionLeftovers));
                        }

                        if(seg.end - seg.start > 0) {
                            this.geolineHandles.push(this.makeGeoline(geoline.geo_line.slice(seg.start, seg.end + 1), MapStyle.Session));
                        }

                        last = seg.end;
                    }.bind(this));

                    if(geoline.geo_line.length - 1 - last > 0) {
                        this.geolineHandles.push(this.makeGeoline(geoline.geo_line.slice(last), MapStyle.SessionLeftovers));
                    }
                // TODO end of stub code
                }.bind(this));
            }
        }
    }

    render() {
        var height = {height: this.props.options.full ? this.props.options.dims.height : 350};

        return (
            <div>
                <div style = {height} ref={ function(node) { this.mapNode = node; }.bind(this) } id = 'cesium'></div>
            </div>
        )
    }

    /* convert the Constants/Map style notation to cesium material */
    getStyle(style) {
        var st = {};

        /* if fill is not present, generate a special version of a material for polyline use */
        if(!style.fill) {
            let stroke = Color.fromCssColorString(style.stroke).withAlpha(style.strokeAlpha);

            if(style.dashed) {
                st.material = new PolylineDashMaterialProperty({
                    color : stroke,
                    dashLength: 10,
                });
            } else if(style.outline) {
                st.material = new PolylineOutlineMaterialProperty({
                    color : stroke,
                    outlineWidth : 2,
                    outlineColor : Color.BLACK });
            } else {
                st.material = stroke;
            }

            st.width = style.width;
        }
        else {
            st.fill = true;
            st.material = Color.fromCssColorString(style.fill).withAlpha(style.fillAlpha);
            st.outline = true;
            st.outlineWidth = style.width;
            st.outlineColor = Color.fromCssColorString(style.stroke).withAlpha(style.strokeAlpha);
            // TODO: can we do a dashed outline?
        }

        return st;
    }
}
