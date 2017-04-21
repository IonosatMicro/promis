var React = require('react');
var Bootstrap = require('react-bootstrap');

var ButtonGroup = Bootstrap.ButtonGroup;
var ToolboxButton = require('./ToolboxButton');

class MapToolBox extends React.Component {
    constructor(props) {
        super(props);

        this.actions = props.onChange;

        /* more this please... */
        this.toggleFlat = this.toggleFlat.bind(this);
        this.toggleFull = this.toggleFull.bind(this);
        this.toggleGrid = this.toggleGrid.bind(this);
    }

    toggleFlat() {
        this.actions.toggleFlat(! this.props.options.flat);
    }

    toggleFull() {
        this.actions.toggleFullscreen(! this.props.options.full);
    }

    toggleGrid() {
        this.actions.toggleGrid(! this.props.options.grid);
    }

    render() {
        var opts = this.props.options;

        return (
            <div className = 'mapToolBox'>
                <ButtonGroup className = 'innerToolBox'>
                    <ToolboxButton onClick = {this.toggleFlat} active = {! opts.flat} icon = 'globe' help = 'Switch to 3D' />
                    <ToolboxButton icon = 'edit' help = 'Select area' />
                    <ToolboxButton icon = 'screenshot' help = 'Select area' />
                    <ToolboxButton onClick = {this.toggleGrid} active = {opts.grid} icon = 'th' help = 'Toggle grid' />
                    <ToolboxButton onClick = {this.toggleFull} icon = {opts.full ? 'resize-small' : 'resize-full'} help = {opts.full ? 'Minimize' : 'Fullscreen'} />
                    <ToolboxButton icon = 'erase' help = 'Erase last selection' />
                    <ToolboxButton icon = 'ban-circle' help = 'Clear all selection' />
                </ButtonGroup>
            </div>
        )
    }
}

module.exports = MapToolBox;