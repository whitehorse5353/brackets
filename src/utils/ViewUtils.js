/*
 * Copyright 2012 Adobe Systems Incorporated. All Rights Reserved.
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define: false, $: false */

define(function (require, exports, module) {
    'use strict';
    
    var SCROLL_SHADOW_HEIGHT = 5;
    
    /**
     * @private
     */
    var _resizeHandlers = [];

    /** If a parent div has overflow:auto then the child will have a problem
     * setting the background color. The reason for this is the width of the 
     * child is the visible width of the parent and not the scrollWidth, so if
     * the div scrolls the background looks wrong.
     * @param {!JQuery} $parent the jQuery parent for the object 
     */
    function updateChildrenToParentScrollwidth($parent) {
        var $children = $parent.children();
        //clear the width first so we get the natural scrollWidth below
        $children.width("");
        
        var targetWidth = $parent[0].scrollWidth -
            parseInt($parent.css("paddingLeft"), 10) -
            parseInt($parent.css("paddingRight"), 10);
        
        $children.width(targetWidth);
    }

    /** 
     * Positions shadow background elements to indicate vertical scrolling.
     * @param {!DOMElement} displayElement the DOMElement that displays the shadow
     * @param {!Object} scrollElement the object that is scrolled
     */
    function _updateScrollerShadow($displayElement, $scrollElement, $shadowTop, $shadowBottom) {
        var offsetTop           = $displayElement.offset().top,
            scrollElement       = $scrollElement.get(0),
            scrollTop           = scrollElement.scrollTop,
            topShadowOffset     = Math.min(scrollTop - SCROLL_SHADOW_HEIGHT, 0);
        
        if ($shadowTop) {
            $shadowTop.css("background-position", "0px " + topShadowOffset + "px");
            $shadowTop.css("top", offsetTop);
        }
        
        if ($shadowBottom) {
            var clientHeight        = scrollElement.clientHeight,
                outerHeight         = $displayElement.outerHeight(),
                scrollHeight        = scrollElement.scrollHeight,
                bottomOffset        = outerHeight - clientHeight,
                bottomShadowOffset  = SCROLL_SHADOW_HEIGHT; // outside of shadow div viewport
            
            if (scrollHeight > clientHeight) {
                bottomShadowOffset -= Math.min(SCROLL_SHADOW_HEIGHT, (scrollHeight - (scrollTop + clientHeight)));
            }
    
            $shadowBottom.css("background-position", "0px " + bottomShadowOffset + "px");
            $shadowBottom.css("top", offsetTop + outerHeight - SCROLL_SHADOW_HEIGHT);
        }
    }

    function getOrCreateShadow($displayElement, position) {
        var $findShadow = $displayElement.find(".scrollerShadow." + position);

        if ($findShadow.length === 0) {
            $findShadow = $(document.createElement("div")).addClass("scrollerShadow " + position);
            $displayElement.append($findShadow);
        }

        return $findShadow;
    }

    /** 
     * Installs event handlers for updatng shadow background elements to indicate vertical scrolling.
     * @param {!DOMElement} displayElement the DOMElement that displays the shadow. Must fire
     *  "contentChanged" events when the element is resized or repositioned.
     * @param {?Object} scrollElement the object that is scrolled. Must fire "scroll" events
     *  when the element is scrolled. If null, the displayElement is used.
     * @param {?boolean} showBottom optionally show the bottom shadow
     */
    function addScrollerShadow(displayElement, scrollElement, showBottom) {
        var sharedDisplayElement    = true;

        if (!scrollElement) {
            scrollElement = displayElement;
            sharedDisplayElement = false;
        }
        
        // update shadows when the scrolling element is scrolled
        var $displayElement = $(displayElement),
            $scrollElement = $(scrollElement);
        
        var $shadowTop = getOrCreateShadow($displayElement, "top");
        var $shadowBottom = (showBottom) ? getOrCreateShadow($displayElement, "bottom") : null;
        
        var doUpdate = function () {
            _updateScrollerShadow($displayElement, $scrollElement, $shadowTop, $shadowBottom);
        };
        
        $scrollElement.on("scroll", doUpdate);

        if (sharedDisplayElement) {
            $scrollElement.on("blur", function () { $scrollElement.off("scroll", doUpdate); });
            $scrollElement.on("focus", function () { $scrollElement.on("scroll", doUpdate); });
        }

        $displayElement.on("contentChanged", doUpdate);
        
        // update immediately
        doUpdate();
    }
    
    /** 
     * Within a scrolling DOMElement, creates and positions a styled selection
     * div to align a single selected list item from a ul list element.
     *
     * Assumptions:
     * - scrollElement is a child of the #file-section div
     * - ul list element fires a "selectionChanged" event after the
     *   selectedClassName is assigned to a new list item
     * 
     * @param {!DOMElement} scrollElement A DOMElement containing a ul list element
     * @param {!string} selectedClassName A CSS class name on at most one list item in the contained list
     */
    function sidebarList($scrollerElement, selectedClassName) {
        var $listElement = $scrollerElement.find("ul"),
            $selectionMarker,
            $selectionTriangle,
            $fileSection = $("#file-section");
        
        // build selectionMarker and position absolute within the scroller
        $selectionMarker = $(document.createElement("div")).addClass("sidebarSelection");
        $scrollerElement.prepend($selectionMarker);
        
        // enable scrolling
        $scrollerElement.css("overflow", "auto");
        
        // use relative postioning for clipping the selectionMarker within the scrollElement
        $scrollerElement.css("position", "relative");
        
        // build selectionTriangle and position fixed to the window
        $selectionTriangle = $(document.createElement("div")).addClass("sidebarSelectionTriangle");
        $fileSection.append($selectionTriangle);
        
        selectedClassName = "." + (selectedClassName || "selected");
        
        var updateSelectionTriangle = function () {
            var scrollerOffset = $scrollerElement.offset(),
                scrollerTop = scrollerOffset.top,
                scrollerBottom = scrollerTop + $scrollerElement.get(0).clientHeight,
                scrollerLeft = scrollerOffset.left,
                triangleTop = $selectionMarker.offset().top,
                triangleHeight = $selectionTriangle.outerHeight(),
                triangleOffsetYBy = $selectionMarker.height() / 2,
                triangleClipOffsetYBy = Math.floor(($selectionMarker.height() - triangleHeight) / 2),
                triangleBottom = triangleTop + triangleHeight + triangleClipOffsetYBy;
            
            $selectionTriangle.css("top", triangleTop + triangleOffsetYBy);
            $selectionTriangle.css("left", $fileSection.width() - $selectionTriangle.outerWidth());
            
            if (triangleTop < scrollerTop || triangleBottom > scrollerBottom) {
                $selectionTriangle.css("clip", "rect(" + Math.max(scrollerTop - triangleTop - triangleClipOffsetYBy, 0) + "px, auto, " +
                                           (triangleHeight - Math.max(triangleBottom - scrollerBottom, 0)) + "px, auto)");
            } else {
                $selectionTriangle.css("clip", "");
            }
        };
        
        var updateSelectionMarker = function () {
            // find the selected list item
            var $listItem = $listElement.find(selectedClassName).closest("li");
            
            if ($listItem.length === 1) {
                // list item position is relative to scroller
                var selectionMarkerTop = $listItem.offset().top - $scrollerElement.offset().top + $scrollerElement.get(0).scrollTop;
                    
                // force selection width to match scroller
                $selectionMarker.width($scrollerElement.get(0).scrollWidth);
                
                // move the selectionMarker position to align with the list item
                $selectionMarker.css("top", selectionMarkerTop);
                $selectionMarker.show();
                
                updateSelectionTriangle();
                
                $selectionTriangle.show();
            
                // fully scroll to the selectionMarker if it's not initially in the viewport
                var scrollerElement = $scrollerElement.get(0),
                    scrollerHeight = scrollerElement.clientHeight,
                    selectionMarkerHeight = $selectionMarker.height(),
                    selectionMarkerBottom = selectionMarkerTop + selectionMarkerHeight,
                    currentScrollBottom = scrollerElement.scrollTop + scrollerHeight;
                
                // update scrollTop to reveal the selected list item
                if (selectionMarkerTop >= currentScrollBottom) {
                    scrollerElement.scrollTop = Math.max(0, selectionMarkerTop + selectionMarkerHeight - scrollerHeight);
                } else if (selectionMarkerBottom <= scrollerElement.scrollTop) {
                    scrollerElement.scrollTop = selectionMarkerTop;
                }
            } else {
                // hide the selection marker when no selection is found
                $selectionTriangle.hide();
                $selectionMarker.hide();
            }
        };
        
        $listElement.on("selectionChanged", updateSelectionMarker);
        $scrollerElement.on("scroll", updateSelectionTriangle);
        
        // update immediately
        updateSelectionMarker();
        
        // update clipping when the window resizes
        _resizeHandlers.push(updateSelectionTriangle);
    }
    
    /**
     * @private
     */
    function handleResize() {
        _resizeHandlers.forEach(function (f) {
            f.apply();
        });
    }
    
    // handle all resize handlers in a single listener
    $(window).resize(handleResize);

    // Define public API
    exports.SCROLL_SHADOW_HEIGHT = SCROLL_SHADOW_HEIGHT;
    
    exports.updateChildrenToParentScrollwidth = updateChildrenToParentScrollwidth;
    exports.addScrollerShadow = addScrollerShadow;
    exports.sidebarList = sidebarList;
});
