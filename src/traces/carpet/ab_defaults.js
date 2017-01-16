/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

// var Lib = require('../../lib');

// var isNumeric = require('fast-isnumeric');
var extendFlat = require('../../lib/extend').extendFlat;
var handleAxisDefaults = require('./axis_defaults');
var attributes = require('./attributes');

module.exports = function handleABDefaults(traceIn, traceOut, fullLayout, coerce) {
    var a = coerce('a');

    if(!a) {
        coerce('da');
        coerce('a0');
    }

    var b = coerce('b');

    if(!b) {
        coerce('db');
        coerce('b0');
    }

    mimickAxisDefaults(traceIn, traceOut, fullLayout);

    return;
};

function mimickAxisDefaults (traceIn, traceOut, fullLayout) {
    var axesList = ['aaxis', 'baxis'];

    axesList.forEach(function(axName) {
        var axLetter = axName.charAt(0),
            axIn = traceIn[axName] || {},
            axOut = {
                _gd: {
                    _fullLayout: {
                        separators: fullLayout.separators
                    }
                }
            },
            defaultOptions = {
                tickfont: 'x',
                id: axLetter + 'axis',
                letter: axLetter,
                font: traceOut.font,
                name: axName,
                data: traceIn[axLetter],
                calendar: traceOut.calendar,
            };

        function coerce(attr, dflt) {
            return Lib.coerce(axIn, axOut, attributes, attr, dflt);
        }

        handleAxisDefaults(axIn, axOut, coerce, defaultOptions);

        axOut._categories = axOut._categories || [];

        traceOut[axName] = axOut;

        // so we don't have to repeat autotype unnecessarily,
        // copy an autotype back to traceIn
        if(!traceIn[axName] && axIn.type !== '-') {
            traceIn[axName] = {type: axIn.type};
        }
    });
}