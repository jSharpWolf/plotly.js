/**
* Copyright 2012-2017, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var Plotly = require('../../plotly');
var Lib = require('../../lib');

var constants = require('../../plots/cartesian/constants');
var interactConstants = require('../../constants/interactions');

var dragElement = module.exports = {};
var mousePos1;
var mousePos2;
var doubleTouch;
var doubleMove;
var clickTimer = null;


dragElement.align = require('./align');
dragElement.getCursor = require('./cursor');

var unhover = require('./unhover');
dragElement.unhover = unhover.wrapped;
dragElement.unhoverRaw = unhover.raw;

/**
 * Abstracts click & drag interactions
 * @param {object} options with keys:
 *      element (required) the DOM element to drag
 *      prepFn (optional) function(event, startX, startY)
 *          executed on mousedown
 *          startX and startY are the clientX and clientY pixel position
 *          of the mousedown event
 *      moveFn (optional) function(dx, dy, dragged)
 *          executed on move
 *          dx and dy are the net pixel offset of the drag,
 *          dragged is true/false, has the mouse moved enough to
 *          constitute a drag
 *      doneFn (optional) function(dragged, numClicks, e)
 *          executed on mouseup, or mouseout of window since
 *          we don't get events after that
 *          dragged is as in moveFn
 *          numClicks is how many clicks we've registered within
 *          a doubleclick time
 *          e is the original event
 *      setCursor (optional) function(event)
 *          executed on mousemove before mousedown
 *          the purpose of this callback is to update the mouse cursor before
 *          the click & drag interaction has been initiated
 */
dragElement.init = function init(options) {
    var gd = Lib.getPlotDiv(options.element) || {},
        numClicks = 1,
        DBLCLICKDELAY = interactConstants.DBLCLICKDELAY,
        startX,
        startY,
        newMouseDownTime,
        dragCover,
        initialTarget,
        initialOnMouseMove;
    if(!gd._mouseDownTime) gd._mouseDownTime = 0;

    //Add Eventlistener for touch move, no duplicates allowed
    var result = document.getElementsByClassName("nsewdrag");
    for(var i = 0;i< result.length;i++){
      if(!result[i].ontouchstart){
        options.element.addEventListener('touchstart', touchstart);
        options.element.addEventListener('touchmove', touchmove);
        options.element.addEventListener('touchend', touchend);
        options.element.ontouchstart = touchstart;
      }
    }

    function onStart(e) {
        // disable call to options.setCursor(evt)
        options.element.onmousemove = initialOnMouseMove;

        // make dragging and dragged into properties of gd
        // so that others can look at and modify them
        gd._dragged = false;
        gd._dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialTarget = e.target;

        newMouseDownTime = (new Date()).getTime();
        if(newMouseDownTime - gd._mouseDownTime < DBLCLICKDELAY) {
            // in a click train
            numClicks += 1;
        }
        else {
            // new click train
            numClicks = 1;
            gd._mouseDownTime = newMouseDownTime;
        }

        if(options.prepFn) options.prepFn(e, startX, startY);

        dragCover = coverSlip();

        dragCover.onmousemove = onMove;
        dragCover.onmouseup = onDone;
        dragCover.onmouseout = onDone;

        dragCover.style.cursor = window.getComputedStyle(options.element).cursor;

        return Lib.pauseEvent(e);
    }

    function touchstart(e) {
      if(!mousePos1){
        if (clickTimer == null) {
          clickTimer = setTimeout(function () {
              clickTimer = null;

          }, 200)
        } else {
          clearTimeout(clickTimer);
          clickTimer = null;
          doubleTouch = true;
        }
         mousePos1 = [
                           e.changedTouches[0].pageX,
                           e.changedTouches[0].pageY
                         ];
       gd._dragged = false;
       gd._dragging = true;
       startX = mousePos1[0];
       startY = mousePos1[1];
       //initialTarget = e.target;
       dragCover = coverSlip();

       dragCover.style.cursor = window.getComputedStyle(options.element).cursor;
      //  if(e.touches.length <= 1){
      //    gd._fullLayout.dragmode = 'pan';
      //  }else if(e.touches.length == 2){
      //    gd._fullLayout.dragmode = 'zoom';
      //  }
       if(options.prepFn) options.prepFn(e, startX, startY);
       return Lib.pauseEvent(e);
      }
    }

    function touchmove(e) {
      if(e.touches.length <= 1){
        //gd._fullLayout.dragmode = 'pan';
        if(mousePos1){
           mousePos2 = [
                             e.changedTouches[0].pageX,
                             e.changedTouches[0].pageY
                           ];
        }
        var dx, dy
        dx = mousePos2[0] - mousePos1[0],
        dy = mousePos2[1] - mousePos1[1]
        if(Math.abs(dx) > 100 || Math.abs(dy) > 10) {
            gd._dragged = true;
            dragElement.unhover(gd);
            if(options.moveFn) options.moveFn(dx, dy, gd._dragged);
        }
      }
    }

    function touchend(e) {
      if(mousePos1 || mousePos2) {

        if(doubleTouch){
          numClicks = 2;
          gd._dragged = false;
        }else{
          numClicks = 1;
          gd._dragged = true;
        }
        doubleTouch = false;
        if(!gd._dragging) {
            gd._dragged = false;
            return;
        }
        gd._dragging = false;
        if(options.doneFn) options.doneFn(gd._dragged, numClicks, e);
        mousePos1 = null;
        mousePos2 = null;
        Lib.removeElement(dragCover);
        finishDrag(gd);
      }
    }

    function onMove(e) {
        var dx = e.clientX - startX,
            dy = e.clientY - startY,
            minDrag = options.minDrag || constants.MINDRAG;

        if(Math.abs(dx) < minDrag) dx = 0;
        if(Math.abs(dy) < minDrag) dy = 0;
        if(dx || dy) {
            gd._dragged = true;
            dragElement.unhover(gd);
        }

        if(options.moveFn) options.moveFn(dx, dy, gd._dragged);

        return Lib.pauseEvent(e);
    }

    function onDone(e) {
        // re-enable call to options.setCursor(evt)
        initialOnMouseMove = options.element.onmousemove;
        if(options.setCursor) options.element.onmousemove = options.setCursor;

        dragCover.onmousemove = null;
        dragCover.onmouseup = null;
        dragCover.onmouseout = null;
        Lib.removeElement(dragCover);

        if(!gd._dragging) {
            gd._dragged = false;
            return;
        }
        gd._dragging = false;

        // don't count as a dblClick unless the mouseUp is also within
        // the dblclick delay
        if((new Date()).getTime() - gd._mouseDownTime > DBLCLICKDELAY) {
            numClicks = Math.max(numClicks - 1, 1);
        }

        if(options.doneFn) options.doneFn(gd._dragged, numClicks, e);

        if(!gd._dragged) {
            var e2;

            try {
                e2 = new MouseEvent('click', e);
            }
            catch(err) {
                e2 = document.createEvent('MouseEvents');
                e2.initMouseEvent('click',
                    e.bubbles, e.cancelable,
                    e.view, e.detail,
                    e.screenX, e.screenY,
                    e.clientX, e.clientY,
                    e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
                    e.button, e.relatedTarget);
            }

            initialTarget.dispatchEvent(e2);
        }

        finishDrag(gd);

        gd._dragged = false;

        return Lib.pauseEvent(e);
    }

    // enable call to options.setCursor(evt)
    initialOnMouseMove = options.element.onmousemove;
    if(options.setCursor) options.element.onmousemove = options.setCursor;

    options.element.onmousedown = onStart;
    options.element.style.pointerEvents = 'all';
};

function coverSlip() {
    var cover = document.createElement('div');

    cover.className = 'dragcover';
    var cStyle = cover.style;
    cStyle.position = 'fixed';
    cStyle.left = 0;
    cStyle.right = 0;
    cStyle.top = 0;
    cStyle.bottom = 0;
    cStyle.zIndex = 999999999;
    cStyle.background = 'none';

    document.body.appendChild(cover);

    return cover;
}

dragElement.coverSlip = coverSlip;

function finishDrag(gd) {
    gd._dragging = false;
    if(gd._replotPending) Plotly.plot(gd);
}
