/*!
Waypoints - 4.0.1
Copyright Â© 2011-2016 Caleb Troughton
Licensed under the MIT license.
https://github.com/imakewebthings/waypoints/blob/master/licenses.txt
*/

import AOS from "aos";
import feather from "feather-icons";

(function() {
  "use strict";

  var keyCounter = 0;
  var allWaypoints = {};

  /* http://imakewebthings.com/waypoints/api/waypoint */
  function Waypoint(options) {
    if (!options) {
      throw new Error("No options passed to Waypoint constructor");
    }
    if (!options.element) {
      throw new Error("No element option passed to Waypoint constructor");
    }
    if (!options.handler) {
      throw new Error("No handler option passed to Waypoint constructor");
    }

    this.key = "waypoint-" + keyCounter;
    this.options = Waypoint.Adapter.extend({}, Waypoint.defaults, options);
    this.element = this.options.element;
    this.adapter = new Waypoint.Adapter(this.element);
    this.callback = options.handler;
    this.axis = this.options.horizontal ? "horizontal" : "vertical";
    this.enabled = this.options.enabled;
    this.triggerPoint = null;
    this.group = Waypoint.Group.findOrCreate({
      name: this.options.group,
      axis: this.axis
    });
    this.context = Waypoint.Context.findOrCreateByElement(this.options.context);

    if (Waypoint.offsetAliases[this.options.offset]) {
      this.options.offset = Waypoint.offsetAliases[this.options.offset];
    }
    this.group.add(this);
    this.context.add(this);
    allWaypoints[this.key] = this;
    keyCounter += 1;
  }

  /* Private */
  Waypoint.prototype.queueTrigger = function(direction) {
    this.group.queueTrigger(this, direction);
  };

  /* Private */
  Waypoint.prototype.trigger = function(args) {
    if (!this.enabled) {
      return;
    }
    if (this.callback) {
      this.callback.apply(this, args);
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy */
  Waypoint.prototype.destroy = function() {
    this.context.remove(this);
    this.group.remove(this);
    delete allWaypoints[this.key];
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable */
  Waypoint.prototype.disable = function() {
    this.enabled = false;
    return this;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable */
  Waypoint.prototype.enable = function() {
    this.context.refresh();
    this.enabled = true;
    return this;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/next */
  Waypoint.prototype.next = function() {
    return this.group.next(this);
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/previous */
  Waypoint.prototype.previous = function() {
    return this.group.previous(this);
  };

  /* Private */
  Waypoint.invokeAll = function(method) {
    var allWaypointsArray = [];
    for (var waypointKey in allWaypoints) {
      allWaypointsArray.push(allWaypoints[waypointKey]);
    }
    for (var i = 0, end = allWaypointsArray.length; i < end; i++) {
      allWaypointsArray[i][method]();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy-all */
  Waypoint.destroyAll = function() {
    Waypoint.invokeAll("destroy");
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable-all */
  Waypoint.disableAll = function() {
    Waypoint.invokeAll("disable");
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable-all */
  Waypoint.enableAll = function() {
    Waypoint.Context.refreshAll();
    for (var waypointKey in allWaypoints) {
      allWaypoints[waypointKey].enabled = true;
    }
    return this;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/refresh-all */
  Waypoint.refreshAll = function() {
    Waypoint.Context.refreshAll();
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-height */
  Waypoint.viewportHeight = function() {
    return window.innerHeight || document.documentElement.clientHeight;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-width */
  Waypoint.viewportWidth = function() {
    return document.documentElement.clientWidth;
  };

  Waypoint.adapters = [];

  Waypoint.defaults = {
    context: window,
    continuous: true,
    enabled: true,
    group: "default",
    horizontal: false,
    offset: 0
  };

  Waypoint.offsetAliases = {
    "bottom-in-view": function() {
      return this.context.innerHeight() - this.adapter.outerHeight();
    },
    "right-in-view": function() {
      return this.context.innerWidth() - this.adapter.outerWidth();
    }
  };

  window.Waypoint = Waypoint;
})();
(function() {
  "use strict";

  function requestAnimationFrameShim(callback) {
    window.setTimeout(callback, 1000 / 60);
  }

  var keyCounter = 0;
  var contexts = {};
  var Waypoint = window.Waypoint;
  var oldWindowLoad = window.onload;

  /* http://imakewebthings.com/waypoints/api/context */
  function Context(element) {
    this.element = element;
    this.Adapter = Waypoint.Adapter;
    this.adapter = new this.Adapter(element);
    this.key = "waypoint-context-" + keyCounter;
    this.didScroll = false;
    this.didResize = false;
    this.oldScroll = {
      x: this.adapter.scrollLeft(),
      y: this.adapter.scrollTop()
    };
    this.waypoints = {
      vertical: {},
      horizontal: {}
    };

    element.waypointContextKey = this.key;
    contexts[element.waypointContextKey] = this;
    keyCounter += 1;
    if (!Waypoint.windowContext) {
      Waypoint.windowContext = true;
      Waypoint.windowContext = new Context(window);
    }

    this.createThrottledScrollHandler();
    this.createThrottledResizeHandler();
  }

  /* Private */
  Context.prototype.add = function(waypoint) {
    var axis = waypoint.options.horizontal ? "horizontal" : "vertical";
    this.waypoints[axis][waypoint.key] = waypoint;
    this.refresh();
  };

  /* Private */
  Context.prototype.checkEmpty = function() {
    var horizontalEmpty = this.Adapter.isEmptyObject(this.waypoints.horizontal);
    var verticalEmpty = this.Adapter.isEmptyObject(this.waypoints.vertical);
    var isWindow = this.element == this.element.window;
    if (horizontalEmpty && verticalEmpty && !isWindow) {
      this.adapter.off(".waypoints");
      delete contexts[this.key];
    }
  };

  /* Private */
  Context.prototype.createThrottledResizeHandler = function() {
    var self = this;

    function resizeHandler() {
      self.handleResize();
      self.didResize = false;
    }

    this.adapter.on("resize.waypoints", function() {
      if (!self.didResize) {
        self.didResize = true;
        Waypoint.requestAnimationFrame(resizeHandler);
      }
    });
  };

  /* Private */
  Context.prototype.createThrottledScrollHandler = function() {
    var self = this;
    function scrollHandler() {
      self.handleScroll();
      self.didScroll = false;
    }

    this.adapter.on("scroll.waypoints", function() {
      if (!self.didScroll || Waypoint.isTouch) {
        self.didScroll = true;
        Waypoint.requestAnimationFrame(scrollHandler);
      }
    });
  };

  /* Private */
  Context.prototype.handleResize = function() {
    Waypoint.Context.refreshAll();
  };

  /* Private */
  Context.prototype.handleScroll = function() {
    var triggeredGroups = {};
    var axes = {
      horizontal: {
        newScroll: this.adapter.scrollLeft(),
        oldScroll: this.oldScroll.x,
        forward: "right",
        backward: "left"
      },
      vertical: {
        newScroll: this.adapter.scrollTop(),
        oldScroll: this.oldScroll.y,
        forward: "down",
        backward: "up"
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];
      var isForward = axis.newScroll > axis.oldScroll;
      var direction = isForward ? axis.forward : axis.backward;

      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        if (waypoint.triggerPoint === null) {
          continue;
        }
        var wasBeforeTriggerPoint = axis.oldScroll < waypoint.triggerPoint;
        var nowAfterTriggerPoint = axis.newScroll >= waypoint.triggerPoint;
        var crossedForward = wasBeforeTriggerPoint && nowAfterTriggerPoint;
        var crossedBackward = !wasBeforeTriggerPoint && !nowAfterTriggerPoint;
        if (crossedForward || crossedBackward) {
          waypoint.queueTrigger(direction);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    for (var groupKey in triggeredGroups) {
      triggeredGroups[groupKey].flushTriggers();
    }

    this.oldScroll = {
      x: axes.horizontal.newScroll,
      y: axes.vertical.newScroll
    };
  };

  /* Private */
  Context.prototype.innerHeight = function() {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportHeight();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerHeight();
  };

  /* Private */
  Context.prototype.remove = function(waypoint) {
    delete this.waypoints[waypoint.axis][waypoint.key];
    this.checkEmpty();
  };

  /* Private */
  Context.prototype.innerWidth = function() {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportWidth();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerWidth();
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-destroy */
  Context.prototype.destroy = function() {
    var allWaypoints = [];
    for (var axis in this.waypoints) {
      for (var waypointKey in this.waypoints[axis]) {
        allWaypoints.push(this.waypoints[axis][waypointKey]);
      }
    }
    for (var i = 0, end = allWaypoints.length; i < end; i++) {
      allWaypoints[i].destroy();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-refresh */
  Context.prototype.refresh = function() {
    /*eslint-disable eqeqeq */
    var isWindow = this.element == this.element.window;
    /*eslint-enable eqeqeq */
    var contextOffset = isWindow ? undefined : this.adapter.offset();
    var triggeredGroups = {};
    var axes;

    this.handleScroll();
    axes = {
      horizontal: {
        contextOffset: isWindow ? 0 : contextOffset.left,
        contextScroll: isWindow ? 0 : this.oldScroll.x,
        contextDimension: this.innerWidth(),
        oldScroll: this.oldScroll.x,
        forward: "right",
        backward: "left",
        offsetProp: "left"
      },
      vertical: {
        contextOffset: isWindow ? 0 : contextOffset.top,
        contextScroll: isWindow ? 0 : this.oldScroll.y,
        contextDimension: this.innerHeight(),
        oldScroll: this.oldScroll.y,
        forward: "down",
        backward: "up",
        offsetProp: "top"
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];
      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var adjustment = waypoint.options.offset;
        var oldTriggerPoint = waypoint.triggerPoint;
        var elementOffset = 0;
        var freshWaypoint = oldTriggerPoint == null;
        var contextModifier, wasBeforeScroll, nowAfterScroll;
        var triggeredBackward, triggeredForward;

        if (waypoint.element !== waypoint.element.window) {
          elementOffset = waypoint.adapter.offset()[axis.offsetProp];
        }

        if (typeof adjustment === "function") {
          adjustment = adjustment.apply(waypoint);
        } else if (typeof adjustment === "string") {
          adjustment = parseFloat(adjustment);
          if (waypoint.options.offset.indexOf("%") > -1) {
            adjustment = Math.ceil((axis.contextDimension * adjustment) / 100);
          }
        }

        contextModifier = axis.contextScroll - axis.contextOffset;
        waypoint.triggerPoint = Math.floor(elementOffset + contextModifier - adjustment);
        wasBeforeScroll = oldTriggerPoint < axis.oldScroll;
        nowAfterScroll = waypoint.triggerPoint >= axis.oldScroll;
        triggeredBackward = wasBeforeScroll && nowAfterScroll;
        triggeredForward = !wasBeforeScroll && !nowAfterScroll;

        if (!freshWaypoint && triggeredBackward) {
          waypoint.queueTrigger(axis.backward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (!freshWaypoint && triggeredForward) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (freshWaypoint && axis.oldScroll >= waypoint.triggerPoint) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    Waypoint.requestAnimationFrame(function() {
      for (var groupKey in triggeredGroups) {
        triggeredGroups[groupKey].flushTriggers();
      }
    });

    return this;
  };

  /* Private */
  Context.findOrCreateByElement = function(element) {
    return Context.findByElement(element) || new Context(element);
  };

  /* Private */
  Context.refreshAll = function() {
    for (var contextId in contexts) {
      contexts[contextId].refresh();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-find-by-element */
  Context.findByElement = function(element) {
    return contexts[element.waypointContextKey];
  };

  window.onload = function() {
    if (oldWindowLoad) {
      oldWindowLoad();
    }
    Context.refreshAll();
  };

  Waypoint.requestAnimationFrame = function(callback) {
    var requestFn =
      window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      requestAnimationFrameShim;
    requestFn.call(window, callback);
  };
  Waypoint.Context = Context;
})();
(function() {
  "use strict";

  function byTriggerPoint(a, b) {
    return a.triggerPoint - b.triggerPoint;
  }

  function byReverseTriggerPoint(a, b) {
    return b.triggerPoint - a.triggerPoint;
  }

  var groups = {
    vertical: {},
    horizontal: {}
  };
  var Waypoint = window.Waypoint;

  /* http://imakewebthings.com/waypoints/api/group */
  function Group(options) {
    this.name = options.name;
    this.axis = options.axis;
    this.id = this.name + "-" + this.axis;
    this.waypoints = [];
    this.clearTriggerQueues();
    groups[this.axis][this.name] = this;
  }

  /* Private */
  Group.prototype.add = function(waypoint) {
    this.waypoints.push(waypoint);
  };

  /* Private */
  Group.prototype.clearTriggerQueues = function() {
    this.triggerQueues = {
      up: [],
      down: [],
      left: [],
      right: []
    };
  };

  /* Private */
  Group.prototype.flushTriggers = function() {
    for (var direction in this.triggerQueues) {
      var waypoints = this.triggerQueues[direction];
      var reverse = direction === "up" || direction === "left";
      waypoints.sort(reverse ? byReverseTriggerPoint : byTriggerPoint);
      for (var i = 0, end = waypoints.length; i < end; i += 1) {
        var waypoint = waypoints[i];
        if (waypoint.options.continuous || i === waypoints.length - 1) {
          waypoint.trigger([direction]);
        }
      }
    }
    this.clearTriggerQueues();
  };

  /* Private */
  Group.prototype.next = function(waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    var isLast = index === this.waypoints.length - 1;
    return isLast ? null : this.waypoints[index + 1];
  };

  /* Private */
  Group.prototype.previous = function(waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    return index ? this.waypoints[index - 1] : null;
  };

  /* Private */
  Group.prototype.queueTrigger = function(waypoint, direction) {
    this.triggerQueues[direction].push(waypoint);
  };

  /* Private */
  Group.prototype.remove = function(waypoint) {
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    if (index > -1) {
      this.waypoints.splice(index, 1);
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/first */
  Group.prototype.first = function() {
    return this.waypoints[0];
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/last */
  Group.prototype.last = function() {
    return this.waypoints[this.waypoints.length - 1];
  };

  /* Private */
  Group.findOrCreate = function(options) {
    return groups[options.axis][options.name] || new Group(options);
  };

  Waypoint.Group = Group;
})();
(function() {
  "use strict";

  var Waypoint = window.Waypoint;

  function isWindow(element) {
    return element === element.window;
  }

  function getWindow(element) {
    if (isWindow(element)) {
      return element;
    }
    return element.defaultView;
  }

  function NoFrameworkAdapter(element) {
    this.element = element;
    this.handlers = {};
  }

  NoFrameworkAdapter.prototype.innerHeight = function() {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerHeight : this.element.clientHeight;
  };

  NoFrameworkAdapter.prototype.innerWidth = function() {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerWidth : this.element.clientWidth;
  };

  NoFrameworkAdapter.prototype.off = function(event, handler) {
    function removeListeners(element, listeners, handler) {
      for (var i = 0, end = listeners.length - 1; i < end; i++) {
        var listener = listeners[i];
        if (!handler || handler === listener) {
          element.removeEventListener(listener);
        }
      }
    }

    var eventParts = event.split(".");
    var eventType = eventParts[0];
    var namespace = eventParts[1];
    var element = this.element;

    if (namespace && this.handlers[namespace] && eventType) {
      removeListeners(element, this.handlers[namespace][eventType], handler);
      this.handlers[namespace][eventType] = [];
    } else if (eventType) {
      for (var ns in this.handlers) {
        removeListeners(element, this.handlers[ns][eventType] || [], handler);
        this.handlers[ns][eventType] = [];
      }
    } else if (namespace && this.handlers[namespace]) {
      for (var type in this.handlers[namespace]) {
        removeListeners(element, this.handlers[namespace][type], handler);
      }
      this.handlers[namespace] = {};
    }
  };

  /* Adapted from jQuery 1.x offset() */
  NoFrameworkAdapter.prototype.offset = function() {
    if (!this.element.ownerDocument) {
      return null;
    }

    var documentElement = this.element.ownerDocument.documentElement;
    var win = getWindow(this.element.ownerDocument);
    var rect = {
      top: 0,
      left: 0
    };

    if (this.element.getBoundingClientRect) {
      rect = this.element.getBoundingClientRect();
    }

    return {
      top: rect.top + win.pageYOffset - documentElement.clientTop,
      left: rect.left + win.pageXOffset - documentElement.clientLeft
    };
  };

  NoFrameworkAdapter.prototype.on = function(event, handler) {
    var eventParts = event.split(".");
    var eventType = eventParts[0];
    var namespace = eventParts[1] || "__default";
    var nsHandlers = (this.handlers[namespace] = this.handlers[namespace] || {});
    var nsTypeList = (nsHandlers[eventType] = nsHandlers[eventType] || []);

    nsTypeList.push(handler);
    this.element.addEventListener(eventType, handler);
  };

  NoFrameworkAdapter.prototype.outerHeight = function(includeMargin) {
    var height = this.innerHeight();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      height += parseInt(computedStyle.marginTop, 10);
      height += parseInt(computedStyle.marginBottom, 10);
    }

    return height;
  };

  NoFrameworkAdapter.prototype.outerWidth = function(includeMargin) {
    var width = this.innerWidth();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      width += parseInt(computedStyle.marginLeft, 10);
      width += parseInt(computedStyle.marginRight, 10);
    }

    return width;
  };

  NoFrameworkAdapter.prototype.scrollLeft = function() {
    var win = getWindow(this.element);
    return win ? win.pageXOffset : this.element.scrollLeft;
  };

  NoFrameworkAdapter.prototype.scrollTop = function() {
    var win = getWindow(this.element);
    return win ? win.pageYOffset : this.element.scrollTop;
  };

  NoFrameworkAdapter.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    function merge(target, obj) {
      if (typeof target === "object" && typeof obj === "object") {
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            target[key] = obj[key];
          }
        }
      }

      return target;
    }

    for (var i = 1, end = args.length; i < end; i++) {
      merge(args[0], args[i]);
    }
    return args[0];
  };

  NoFrameworkAdapter.inArray = function(element, array, i) {
    return array == null ? -1 : array.indexOf(element, i);
  };

  NoFrameworkAdapter.isEmptyObject = function(obj) {
    /* eslint no-unused-vars: 0 */
    for (var name in obj) {
      return false;
    }
    return true;
  };

  Waypoint.adapters.push({
    name: "noframework",
    Adapter: NoFrameworkAdapter
  });
  Waypoint.Adapter = NoFrameworkAdapter;
})();
!(function(e, t) {
  "object" == typeof exports && "object" == typeof module
    ? (module.exports = t())
    : "function" == typeof define && define.amd
    ? define([], t)
    : "object" == typeof exports
    ? null
    : null;
})(this, function() {
  return (function(e) {
    function t(o) {
      if (n[o]) return n[o].exports;
      var i = (n[o] = { exports: {}, id: o, loaded: !1 });
      return e[o].call(i.exports, i, i.exports, t), (i.loaded = !0), i.exports;
    }
    var n = {};
    return (t.m = e), (t.c = n), (t.p = "dist/"), t(0);
  })([
    function(e, t, n) {
      "use strict";
      function o(e) {
        return e && e.__esModule ? e : { default: e };
      }
      var i =
          Object.assign ||
          function(e) {
            for (var t = 1; t < arguments.length; t++) {
              var n = arguments[t];
              for (var o in n) Object.prototype.hasOwnProperty.call(n, o) && (e[o] = n[o]);
            }
            return e;
          },
        r = n(1),
        a = (o(r), n(6)),
        u = o(a),
        c = n(7),
        s = o(c),
        f = n(8),
        d = o(f),
        l = n(9),
        p = o(l),
        m = n(10),
        b = o(m),
        v = n(11),
        y = o(v),
        g = n(14),
        h = o(g),
        w = [],
        k = !1,
        x = {
          offset: 120,
          delay: 0,
          easing: "ease",
          duration: 400,
          disable: !1,
          once: !1,
          startEvent: "DOMContentLoaded",
          throttleDelay: 99,
          debounceDelay: 50,
          disableMutationObserver: !1
        },
        j = function() {
          var e = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
          if ((e && (k = !0), k)) return (w = (0, y.default)(w, x)), (0, b.default)(w, x.once), w;
        },
        O = function() {
          (w = (0, h.default)()), j();
        },
        M = function() {
          w.forEach(function(e, t) {
            e.node.removeAttribute("data-aos"),
              e.node.removeAttribute("data-aos-easing"),
              e.node.removeAttribute("data-aos-duration"),
              e.node.removeAttribute("data-aos-delay");
          });
        },
        S = function(e) {
          return (
            e === !0 ||
            ("mobile" === e && p.default.mobile()) ||
            ("phone" === e && p.default.phone()) ||
            ("tablet" === e && p.default.tablet()) ||
            ("function" == typeof e && e() === !0)
          );
        },
        _ = function(e) {
          (x = i(x, e)), (w = (0, h.default)());
          var t = document.all && !window.atob;
          return S(x.disable) || t
            ? M()
            : (x.disableMutationObserver ||
                d.default.isSupported() ||
                (console.info(
                  '\n      aos: MutationObserver is not supported on this browser,\n      code mutations observing has been disabled.\n      You may have to call "refreshHard()" by yourself.\n    '
                ),
                (x.disableMutationObserver = !0)),
              document.querySelector("body").setAttribute("data-aos-easing", x.easing),
              document.querySelector("body").setAttribute("data-aos-duration", x.duration),
              document.querySelector("body").setAttribute("data-aos-delay", x.delay),
              "DOMContentLoaded" === x.startEvent &&
              ["complete", "interactive"].indexOf(document.readyState) > -1
                ? j(!0)
                : "load" === x.startEvent
                ? window.addEventListener(x.startEvent, function() {
                    j(!0);
                  })
                : document.addEventListener(x.startEvent, function() {
                    j(!0);
                  }),
              window.addEventListener("resize", (0, s.default)(j, x.debounceDelay, !0)),
              window.addEventListener("orientationchange", (0, s.default)(j, x.debounceDelay, !0)),
              window.addEventListener(
                "scroll",
                (0, u.default)(function() {
                  (0, b.default)(w, x.once);
                }, x.throttleDelay)
              ),
              x.disableMutationObserver || d.default.ready("[data-aos]", O),
              w);
        };
      e.exports = { init: _, refresh: j, refreshHard: O };
    },
    function(e, t) {},
    ,
    ,
    ,
    ,
    function(e, t) {
      (function(t) {
        "use strict";
        function n(e, t, n) {
          function o(t) {
            var n = b,
              o = v;
            return (b = v = void 0), (k = t), (g = e.apply(o, n));
          }
          function r(e) {
            return (k = e), (h = setTimeout(f, t)), M ? o(e) : g;
          }
          function a(e) {
            var n = e - w,
              o = e - k,
              i = t - n;
            return S ? j(i, y - o) : i;
          }
          function c(e) {
            var n = e - w,
              o = e - k;
            return void 0 === w || n >= t || n < 0 || (S && o >= y);
          }
          function f() {
            var e = O();
            return c(e) ? d(e) : void (h = setTimeout(f, a(e)));
          }
          function d(e) {
            return (h = void 0), _ && b ? o(e) : ((b = v = void 0), g);
          }
          function l() {
            void 0 !== h && clearTimeout(h), (k = 0), (b = w = v = h = void 0);
          }
          function p() {
            return void 0 === h ? g : d(O());
          }
          function m() {
            var e = O(),
              n = c(e);
            if (((b = arguments), (v = this), (w = e), n)) {
              if (void 0 === h) return r(w);
              if (S) return (h = setTimeout(f, t)), o(w);
            }
            return void 0 === h && (h = setTimeout(f, t)), g;
          }
          var b,
            v,
            y,
            g,
            h,
            w,
            k = 0,
            M = !1,
            S = !1,
            _ = !0;
          if ("function" != typeof e) throw new TypeError(s);
          return (
            (t = u(t) || 0),
            i(n) &&
              ((M = !!n.leading),
              (S = "maxWait" in n),
              (y = S ? x(u(n.maxWait) || 0, t) : y),
              (_ = "trailing" in n ? !!n.trailing : _)),
            (m.cancel = l),
            (m.flush = p),
            m
          );
        }
        function o(e, t, o) {
          var r = !0,
            a = !0;
          if ("function" != typeof e) throw new TypeError(s);
          return (
            i(o) &&
              ((r = "leading" in o ? !!o.leading : r), (a = "trailing" in o ? !!o.trailing : a)),
            n(e, t, { leading: r, maxWait: t, trailing: a })
          );
        }
        function i(e) {
          var t = "undefined" == typeof e ? "undefined" : c(e);
          return !!e && ("object" == t || "function" == t);
        }
        function r(e) {
          return !!e && "object" == ("undefined" == typeof e ? "undefined" : c(e));
        }
        function a(e) {
          return (
            "symbol" == ("undefined" == typeof e ? "undefined" : c(e)) || (r(e) && k.call(e) == d)
          );
        }
        function u(e) {
          if ("number" == typeof e) return e;
          if (a(e)) return f;
          if (i(e)) {
            var t = "function" == typeof e.valueOf ? e.valueOf() : e;
            e = i(t) ? t + "" : t;
          }
          if ("string" != typeof e) return 0 === e ? e : +e;
          e = e.replace(l, "");
          var n = m.test(e);
          return n || b.test(e) ? v(e.slice(2), n ? 2 : 8) : p.test(e) ? f : +e;
        }
        var c =
            "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
              ? function(e) {
                  return typeof e;
                }
              : function(e) {
                  return e &&
                    "function" == typeof Symbol &&
                    e.constructor === Symbol &&
                    e !== Symbol.prototype
                    ? "symbol"
                    : typeof e;
                },
          s = "Expected a function",
          f = NaN,
          d = "[object Symbol]",
          l = /^\s+|\s+$/g,
          p = /^[-+]0x[0-9a-f]+$/i,
          m = /^0b[01]+$/i,
          b = /^0o[0-7]+$/i,
          v = parseInt,
          y =
            "object" == ("undefined" == typeof t ? "undefined" : c(t)) &&
            t &&
            t.Object === Object &&
            t,
          g =
            "object" == ("undefined" == typeof self ? "undefined" : c(self)) &&
            self &&
            self.Object === Object &&
            self,
          h = y || g || Function("return this")(),
          w = Object.prototype,
          k = w.toString,
          x = Math.max,
          j = Math.min,
          O = function() {
            return h.Date.now();
          };
        e.exports = o;
      }.call(
        t,
        (function() {
          return this;
        })()
      ));
    },
    function(e, t) {
      (function(t) {
        "use strict";
        function n(e, t, n) {
          function i(t) {
            var n = b,
              o = v;
            return (b = v = void 0), (O = t), (g = e.apply(o, n));
          }
          function r(e) {
            return (O = e), (h = setTimeout(f, t)), M ? i(e) : g;
          }
          function u(e) {
            var n = e - w,
              o = e - O,
              i = t - n;
            return S ? x(i, y - o) : i;
          }
          function s(e) {
            var n = e - w,
              o = e - O;
            return void 0 === w || n >= t || n < 0 || (S && o >= y);
          }
          function f() {
            var e = j();
            return s(e) ? d(e) : void (h = setTimeout(f, u(e)));
          }
          function d(e) {
            return (h = void 0), _ && b ? i(e) : ((b = v = void 0), g);
          }
          function l() {
            void 0 !== h && clearTimeout(h), (O = 0), (b = w = v = h = void 0);
          }
          function p() {
            return void 0 === h ? g : d(j());
          }
          function m() {
            var e = j(),
              n = s(e);
            if (((b = arguments), (v = this), (w = e), n)) {
              if (void 0 === h) return r(w);
              if (S) return (h = setTimeout(f, t)), i(w);
            }
            return void 0 === h && (h = setTimeout(f, t)), g;
          }
          var b,
            v,
            y,
            g,
            h,
            w,
            O = 0,
            M = !1,
            S = !1,
            _ = !0;
          if ("function" != typeof e) throw new TypeError(c);
          return (
            (t = a(t) || 0),
            o(n) &&
              ((M = !!n.leading),
              (S = "maxWait" in n),
              (y = S ? k(a(n.maxWait) || 0, t) : y),
              (_ = "trailing" in n ? !!n.trailing : _)),
            (m.cancel = l),
            (m.flush = p),
            m
          );
        }
        function o(e) {
          var t = "undefined" == typeof e ? "undefined" : u(e);
          return !!e && ("object" == t || "function" == t);
        }
        function i(e) {
          return !!e && "object" == ("undefined" == typeof e ? "undefined" : u(e));
        }
        function r(e) {
          return (
            "symbol" == ("undefined" == typeof e ? "undefined" : u(e)) || (i(e) && w.call(e) == f)
          );
        }
        function a(e) {
          if ("number" == typeof e) return e;
          if (r(e)) return s;
          if (o(e)) {
            var t = "function" == typeof e.valueOf ? e.valueOf() : e;
            e = o(t) ? t + "" : t;
          }
          if ("string" != typeof e) return 0 === e ? e : +e;
          e = e.replace(d, "");
          var n = p.test(e);
          return n || m.test(e) ? b(e.slice(2), n ? 2 : 8) : l.test(e) ? s : +e;
        }
        var u =
            "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
              ? function(e) {
                  return typeof e;
                }
              : function(e) {
                  return e &&
                    "function" == typeof Symbol &&
                    e.constructor === Symbol &&
                    e !== Symbol.prototype
                    ? "symbol"
                    : typeof e;
                },
          c = "Expected a function",
          s = NaN,
          f = "[object Symbol]",
          d = /^\s+|\s+$/g,
          l = /^[-+]0x[0-9a-f]+$/i,
          p = /^0b[01]+$/i,
          m = /^0o[0-7]+$/i,
          b = parseInt,
          v =
            "object" == ("undefined" == typeof t ? "undefined" : u(t)) &&
            t &&
            t.Object === Object &&
            t,
          y =
            "object" == ("undefined" == typeof self ? "undefined" : u(self)) &&
            self &&
            self.Object === Object &&
            self,
          g = v || y || Function("return this")(),
          h = Object.prototype,
          w = h.toString,
          k = Math.max,
          x = Math.min,
          j = function() {
            return g.Date.now();
          };
        e.exports = n;
      }.call(
        t,
        (function() {
          return this;
        })()
      ));
    },
    function(e, t) {
      "use strict";
      function n(e) {
        var t = void 0,
          o = void 0,
          i = void 0;
        for (t = 0; t < e.length; t += 1) {
          if (((o = e[t]), o.dataset && o.dataset.aos)) return !0;
          if ((i = o.children && n(o.children))) return !0;
        }
        return !1;
      }
      function o() {
        return (
          window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver
        );
      }
      function i() {
        return !!o();
      }
      function r(e, t) {
        var n = window.document,
          i = o(),
          r = new i(a);
        (u = t), r.observe(n.documentElement, { childList: !0, subtree: !0, removedNodes: !0 });
      }
      function a(e) {
        e &&
          e.forEach(function(e) {
            var t = Array.prototype.slice.call(e.addedNodes),
              o = Array.prototype.slice.call(e.removedNodes),
              i = t.concat(o);
            if (n(i)) return u();
          });
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var u = function() {};
      t.default = { isSupported: i, ready: r };
    },
    function(e, t) {
      "use strict";
      function n(e, t) {
        if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function");
      }
      function o() {
        return navigator.userAgent || navigator.vendor || window.opera || "";
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = (function() {
          function e(e, t) {
            for (var n = 0; n < t.length; n++) {
              var o = t[n];
              (o.enumerable = o.enumerable || !1),
                (o.configurable = !0),
                "value" in o && (o.writable = !0),
                Object.defineProperty(e, o.key, o);
            }
          }
          return function(t, n, o) {
            return n && e(t.prototype, n), o && e(t, o), t;
          };
        })(),
        r = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i,
        a = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,
        u = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i,
        c = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,
        s = (function() {
          function e() {
            n(this, e);
          }
          return (
            i(e, [
              {
                key: "phone",
                value: function() {
                  var e = o();
                  return !(!r.test(e) && !a.test(e.substr(0, 4)));
                }
              },
              {
                key: "mobile",
                value: function() {
                  var e = o();
                  return !(!u.test(e) && !c.test(e.substr(0, 4)));
                }
              },
              {
                key: "tablet",
                value: function() {
                  return this.mobile() && !this.phone();
                }
              }
            ]),
            e
          );
        })();
      t.default = new s();
    },
    function(e, t) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 });
      var n = function(e, t, n) {
          var o = e.node.getAttribute("data-aos-once");
          t > e.position
            ? e.node.classList.add("aos-animate")
            : "undefined" != typeof o &&
              ("false" === o || (!n && "true" !== o)) &&
              e.node.classList.remove("aos-animate");
        },
        o = function(e, t) {
          var o = window.pageYOffset,
            i = window.innerHeight;
          e.forEach(function(e, r) {
            n(e, i + o, t);
          });
        };
      t.default = o;
    },
    function(e, t, n) {
      "use strict";
      function o(e) {
        return e && e.__esModule ? e : { default: e };
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = n(12),
        r = o(i),
        a = function(e, t) {
          return (
            e.forEach(function(e, n) {
              e.node.classList.add("aos-init"), (e.position = (0, r.default)(e.node, t.offset));
            }),
            e
          );
        };
      t.default = a;
    },
    function(e, t, n) {
      "use strict";
      function o(e) {
        return e && e.__esModule ? e : { default: e };
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = n(13),
        r = o(i),
        a = function(e, t) {
          var n = 0,
            o = 0,
            i = window.innerHeight,
            a = {
              offset: e.getAttribute("data-aos-offset"),
              anchor: e.getAttribute("data-aos-anchor"),
              anchorPlacement: e.getAttribute("data-aos-anchor-placement")
            };
          switch (
            (a.offset && !isNaN(a.offset) && (o = parseInt(a.offset)),
            a.anchor &&
              document.querySelectorAll(a.anchor) &&
              (e = document.querySelectorAll(a.anchor)[0]),
            (n = (0, r.default)(e).top),
            a.anchorPlacement)
          ) {
            case "top-bottom":
              break;
            case "center-bottom":
              n += e.offsetHeight / 2;
              break;
            case "bottom-bottom":
              n += e.offsetHeight;
              break;
            case "top-center":
              n += i / 2;
              break;
            case "bottom-center":
              n += i / 2 + e.offsetHeight;
              break;
            case "center-center":
              n += i / 2 + e.offsetHeight / 2;
              break;
            case "top-top":
              n += i;
              break;
            case "bottom-top":
              n += e.offsetHeight + i;
              break;
            case "center-top":
              n += e.offsetHeight / 2 + i;
          }
          return a.anchorPlacement || a.offset || isNaN(t) || (o = t), n + o;
        };
      t.default = a;
    },
    function(e, t) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 });
      var n = function(e) {
        for (var t = 0, n = 0; e && !isNaN(e.offsetLeft) && !isNaN(e.offsetTop); )
          (t += e.offsetLeft - ("BODY" != e.tagName ? e.scrollLeft : 0)),
            (n += e.offsetTop - ("BODY" != e.tagName ? e.scrollTop : 0)),
            (e = e.offsetParent);
        return { top: n, left: t };
      };
      t.default = n;
    },
    function(e, t) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 });
      var n = function(e) {
        return (
          (e = e || document.querySelectorAll("[data-aos]")),
          Array.prototype.map.call(e, function(e) {
            return { node: e };
          })
        );
      };
      t.default = n;
    }
  ]);
});
/*!
 *
 *   typed.js - A JavaScript Typing Animation Library
 *   Author: Matt Boldt <me@mattboldt.com>
 *   Version: v2.0.9
 *   Url: https://github.com/mattboldt/typed.js
 *   License(s): MIT
 *
 */
(function webpackUniversalModuleDefinition(root, factory) {
  if (typeof exports === "object" && typeof module === "object") module.exports = factory();
  else if (typeof define === "function" && define.amd) define([], factory);
  else if (typeof exports === "object") exports["Typed"] = factory();
  else root ? (root["Typed"] = factory()) : null;
  window.Typed = factory();
})(this, function() {
  return /******/ (function(modules) {
    // webpackBootstrap
    /******/ // The module cache
    /******/ var installedModules = {}; // The require function
    /******/
    /******/ /******/ function __webpack_require__(moduleId) {
      /******/
      /******/ // Check if module is in cache
      /******/ if (installedModules[moduleId]) /******/ return installedModules[moduleId].exports; // Create a new module (and put it into the cache)
      /******/
      /******/ /******/ var module = (installedModules[moduleId] = {
        /******/ exports: {},
        /******/ id: moduleId,
        /******/ loaded: false
        /******/
      }); // Execute the module function
      /******/
      /******/ /******/ modules[moduleId].call(
        module.exports,
        module,
        module.exports,
        __webpack_require__
      ); // Flag the module as loaded
      /******/
      /******/ /******/ module.loaded = true; // Return the exports of the module
      /******/
      /******/ /******/ return module.exports;
      /******/
    } // expose the modules object (__webpack_modules__)
    /******/
    /******/
    /******/ /******/ __webpack_require__.m = modules; // expose the module cache
    /******/
    /******/ /******/ __webpack_require__.c = installedModules; // __webpack_public_path__
    /******/
    /******/ /******/ __webpack_require__.p = ""; // Load entry module and return exports
    /******/
    /******/ /******/ return __webpack_require__(0);
    /******/
  })(
    /************************************************************************/
    /******/ [
      /* 0 */
      /***/ function(module, exports, __webpack_require__) {
        "use strict";

        Object.defineProperty(exports, "__esModule", {
          value: true
        });

        var _createClass = (function() {
          function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
              var descriptor = props[i];
              descriptor.enumerable = descriptor.enumerable || false;
              descriptor.configurable = true;
              if ("value" in descriptor) descriptor.writable = true;
              Object.defineProperty(target, descriptor.key, descriptor);
            }
          }
          return function(Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
          };
        })();

        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }

        var _initializerJs = __webpack_require__(1);

        var _htmlParserJs = __webpack_require__(3);

        /**
         * Welcome to Typed.js!
         * @param {string} elementId HTML element ID _OR_ HTML element
         * @param {object} options options object
         * @returns {object} a new Typed object
         */

        var Typed = (function() {
          function Typed(elementId, options) {
            _classCallCheck(this, Typed);

            // Initialize it up
            _initializerJs.initializer.load(this, options, elementId);
            // All systems go!
            this.begin();
          }

          /**
           * Toggle start() and stop() of the Typed instance
           * @public
           */

          _createClass(Typed, [
            {
              key: "toggle",
              value: function toggle() {
                this.pause.status ? this.start() : this.stop();
              }

              /**
               * Stop typing / backspacing and enable cursor blinking
               * @public
               */
            },
            {
              key: "stop",
              value: function stop() {
                if (this.typingComplete) return;
                if (this.pause.status) return;
                this.toggleBlinking(true);
                this.pause.status = true;
                this.options.onStop(this.arrayPos, this);
              }

              /**
               * Start typing / backspacing after being stopped
               * @public
               */
            },
            {
              key: "start",
              value: function start() {
                if (this.typingComplete) return;
                if (!this.pause.status) return;
                this.pause.status = false;
                if (this.pause.typewrite) {
                  this.typewrite(this.pause.curString, this.pause.curStrPos);
                } else {
                  this.backspace(this.pause.curString, this.pause.curStrPos);
                }
                this.options.onStart(this.arrayPos, this);
              }

              /**
               * Destroy this instance of Typed
               * @public
               */
            },
            {
              key: "destroy",
              value: function destroy() {
                this.reset(false);
                this.options.onDestroy(this);
              }

              /**
               * Reset Typed and optionally restarts
               * @param {boolean} restart
               * @public
               */
            },
            {
              key: "reset",
              value: function reset() {
                var restart =
                  arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

                clearInterval(this.timeout);
                this.replaceText("");
                if (this.cursor && this.cursor.parentNode) {
                  this.cursor.parentNode.removeChild(this.cursor);
                  this.cursor = null;
                }
                this.strPos = 0;
                this.arrayPos = 0;
                this.curLoop = 0;
                if (restart) {
                  this.insertCursor();
                  this.options.onReset(this);
                  this.begin();
                }
              }

              /**
               * Begins the typing animation
               * @private
               */
            },
            {
              key: "begin",
              value: function begin() {
                var _this = this;

                this.typingComplete = false;
                this.shuffleStringsIfNeeded(this);
                this.insertCursor();
                if (this.bindInputFocusEvents) this.bindFocusEvents();
                this.timeout = setTimeout(function() {
                  // Check if there is some text in the element, if yes start by backspacing the default message
                  if (!_this.currentElContent || _this.currentElContent.length === 0) {
                    _this.typewrite(_this.strings[_this.sequence[_this.arrayPos]], _this.strPos);
                  } else {
                    // Start typing
                    _this.backspace(_this.currentElContent, _this.currentElContent.length);
                  }
                }, this.startDelay);
              }

              /**
               * Called for each character typed
               * @param {string} curString the current string in the strings array
               * @param {number} curStrPos the current position in the curString
               * @private
               */
            },
            {
              key: "typewrite",
              value: function typewrite(curString, curStrPos) {
                var _this2 = this;

                if (this.fadeOut && this.el.classList.contains(this.fadeOutClass)) {
                  this.el.classList.remove(this.fadeOutClass);
                  if (this.cursor) this.cursor.classList.remove(this.fadeOutClass);
                }

                var humanize = this.humanizer(this.typeSpeed);
                var numChars = 1;

                if (this.pause.status === true) {
                  this.setPauseStatus(curString, curStrPos, true);
                  return;
                }

                // contain typing function in a timeout humanize'd delay
                this.timeout = setTimeout(function() {
                  // skip over any HTML chars
                  curStrPos = _htmlParserJs.htmlParser.typeHtmlChars(curString, curStrPos, _this2);

                  var pauseTime = 0;
                  var substr = curString.substr(curStrPos);
                  // check for an escape character before a pause value
                  // format: \^\d+ .. eg: ^1000 .. should be able to print the ^ too using ^^
                  // single ^ are removed from string
                  if (substr.charAt(0) === "^") {
                    if (/^\^\d+/.test(substr)) {
                      var skip = 1; // skip at least 1
                      substr = /\d+/.exec(substr)[0];
                      skip += substr.length;
                      pauseTime = parseInt(substr);
                      _this2.temporaryPause = true;
                      _this2.options.onTypingPaused(_this2.arrayPos, _this2);
                      // strip out the escape character and pause value so they're not printed
                      curString =
                        curString.substring(0, curStrPos) + curString.substring(curStrPos + skip);
                      _this2.toggleBlinking(true);
                    }
                  }

                  // check for skip characters formatted as
                  // "this is a `string to print NOW` ..."
                  if (substr.charAt(0) === "`") {
                    while (curString.substr(curStrPos + numChars).charAt(0) !== "`") {
                      numChars++;
                      if (curStrPos + numChars > curString.length) break;
                    }
                    // strip out the escape characters and append all the string in between
                    var stringBeforeSkip = curString.substring(0, curStrPos);
                    var stringSkipped = curString.substring(
                      stringBeforeSkip.length + 1,
                      curStrPos + numChars
                    );
                    var stringAfterSkip = curString.substring(curStrPos + numChars + 1);
                    curString = stringBeforeSkip + stringSkipped + stringAfterSkip;
                    numChars--;
                  }

                  // timeout for any pause after a character
                  _this2.timeout = setTimeout(function() {
                    // Accounts for blinking while paused
                    _this2.toggleBlinking(false);

                    // We're done with this sentence!
                    if (curStrPos >= curString.length) {
                      _this2.doneTyping(curString, curStrPos);
                    } else {
                      _this2.keepTyping(curString, curStrPos, numChars);
                    }
                    // end of character pause
                    if (_this2.temporaryPause) {
                      _this2.temporaryPause = false;
                      _this2.options.onTypingResumed(_this2.arrayPos, _this2);
                    }
                  }, pauseTime);

                  // humanized value for typing
                }, humanize);
              }

              /**
               * Continue to the next string & begin typing
               * @param {string} curString the current string in the strings array
               * @param {number} curStrPos the current position in the curString
               * @private
               */
            },
            {
              key: "keepTyping",
              value: function keepTyping(curString, curStrPos, numChars) {
                // call before functions if applicable
                if (curStrPos === 0) {
                  this.toggleBlinking(false);
                  this.options.preStringTyped(this.arrayPos, this);
                }
                // start typing each new char into existing string
                // curString: arg, this.el.html: original text inside element
                curStrPos += numChars;
                var nextString = curString.substr(0, curStrPos);
                this.replaceText(nextString);
                // loop the function
                this.typewrite(curString, curStrPos);
              }

              /**
               * We're done typing all strings
               * @param {string} curString the current string in the strings array
               * @param {number} curStrPos the current position in the curString
               * @private
               */
            },
            {
              key: "doneTyping",
              value: function doneTyping(curString, curStrPos) {
                var _this3 = this;

                // fires callback function
                this.options.onStringTyped(this.arrayPos, this);
                this.toggleBlinking(true);
                // is this the final string
                if (this.arrayPos === this.strings.length - 1) {
                  // callback that occurs on the last typed string
                  this.complete();
                  // quit if we wont loop back
                  if (this.loop === false || this.curLoop === this.loopCount) {
                    return;
                  }
                }
                this.timeout = setTimeout(function() {
                  _this3.backspace(curString, curStrPos);
                }, this.backDelay);
              }

              /**
               * Backspaces 1 character at a time
               * @param {string} curString the current string in the strings array
               * @param {number} curStrPos the current position in the curString
               * @private
               */
            },
            {
              key: "backspace",
              value: function backspace(curString, curStrPos) {
                var _this4 = this;

                if (this.pause.status === true) {
                  this.setPauseStatus(curString, curStrPos, true);
                  return;
                }
                if (this.fadeOut) return this.initFadeOut();

                this.toggleBlinking(false);
                var humanize = this.humanizer(this.backSpeed);

                this.timeout = setTimeout(function() {
                  curStrPos = _htmlParserJs.htmlParser.backSpaceHtmlChars(
                    curString,
                    curStrPos,
                    _this4
                  );
                  // replace text with base text + typed characters
                  var curStringAtPosition = curString.substr(0, curStrPos);
                  _this4.replaceText(curStringAtPosition);

                  // if smartBack is enabled
                  if (_this4.smartBackspace) {
                    // the remaining part of the current string is equal of the same part of the new string
                    var nextString = _this4.strings[_this4.arrayPos + 1];
                    if (nextString && curStringAtPosition === nextString.substr(0, curStrPos)) {
                      _this4.stopNum = curStrPos;
                    } else {
                      _this4.stopNum = 0;
                    }
                  }

                  // if the number (id of character in current string) is
                  // less than the stop number, keep going
                  if (curStrPos > _this4.stopNum) {
                    // subtract characters one by one
                    curStrPos--;
                    // loop the function
                    _this4.backspace(curString, curStrPos);
                  } else if (curStrPos <= _this4.stopNum) {
                    // if the stop number has been reached, increase
                    // array position to next string
                    _this4.arrayPos++;
                    // When looping, begin at the beginning after backspace complete
                    if (_this4.arrayPos === _this4.strings.length) {
                      _this4.arrayPos = 0;
                      _this4.options.onLastStringBackspaced();
                      _this4.shuffleStringsIfNeeded();
                      _this4.begin();
                    } else {
                      _this4.typewrite(_this4.strings[_this4.sequence[_this4.arrayPos]], curStrPos);
                    }
                  }
                  // humanized value for typing
                }, humanize);
              }

              /**
               * Full animation is complete
               * @private
               */
            },
            {
              key: "complete",
              value: function complete() {
                this.options.onComplete(this);
                if (this.loop) {
                  this.curLoop++;
                } else {
                  this.typingComplete = true;
                }
              }

              /**
               * Has the typing been stopped
               * @param {string} curString the current string in the strings array
               * @param {number} curStrPos the current position in the curString
               * @param {boolean} isTyping
               * @private
               */
            },
            {
              key: "setPauseStatus",
              value: function setPauseStatus(curString, curStrPos, isTyping) {
                this.pause.typewrite = isTyping;
                this.pause.curString = curString;
                this.pause.curStrPos = curStrPos;
              }

              /**
               * Toggle the blinking cursor
               * @param {boolean} isBlinking
               * @private
               */
            },
            {
              key: "toggleBlinking",
              value: function toggleBlinking(isBlinking) {
                if (!this.cursor) return;
                // if in paused state, don't toggle blinking a 2nd time
                if (this.pause.status) return;
                if (this.cursorBlinking === isBlinking) return;
                this.cursorBlinking = isBlinking;
                if (isBlinking) {
                  this.cursor.classList.add("typed-cursor--blink");
                } else {
                  this.cursor.classList.remove("typed-cursor--blink");
                }
              }

              /**
               * Speed in MS to type
               * @param {number} speed
               * @private
               */
            },
            {
              key: "humanizer",
              value: function humanizer(speed) {
                return Math.round((Math.random() * speed) / 2) + speed;
              }

              /**
               * Shuffle the sequence of the strings array
               * @private
               */
            },
            {
              key: "shuffleStringsIfNeeded",
              value: function shuffleStringsIfNeeded() {
                if (!this.shuffle) return;
                this.sequence = this.sequence.sort(function() {
                  return Math.random() - 0.5;
                });
              }

              /**
               * Adds a CSS class to fade out current string
               * @private
               */
            },
            {
              key: "initFadeOut",
              value: function initFadeOut() {
                var _this5 = this;

                this.el.className += " " + this.fadeOutClass;
                if (this.cursor) this.cursor.className += " " + this.fadeOutClass;
                return setTimeout(function() {
                  _this5.arrayPos++;
                  _this5.replaceText("");

                  // Resets current string if end of loop reached
                  if (_this5.strings.length > _this5.arrayPos) {
                    _this5.typewrite(_this5.strings[_this5.sequence[_this5.arrayPos]], 0);
                  } else {
                    _this5.typewrite(_this5.strings[0], 0);
                    _this5.arrayPos = 0;
                  }
                }, this.fadeOutDelay);
              }

              /**
               * Replaces current text in the HTML element
               * depending on element type
               * @param {string} str
               * @private
               */
            },
            {
              key: "replaceText",
              value: function replaceText(str) {
                if (this.attr) {
                  this.el.setAttribute(this.attr, str);
                } else {
                  if (this.isInput) {
                    this.el.value = str;
                  } else if (this.contentType === "html") {
                    this.el.innerHTML = str;
                  } else {
                    this.el.textContent = str;
                  }
                }
              }

              /**
               * If using input elements, bind focus in order to
               * start and stop the animation
               * @private
               */
            },
            {
              key: "bindFocusEvents",
              value: function bindFocusEvents() {
                var _this6 = this;

                if (!this.isInput) return;
                this.el.addEventListener("focus", function(e) {
                  _this6.stop();
                });
                this.el.addEventListener("blur", function(e) {
                  if (_this6.el.value && _this6.el.value.length !== 0) {
                    return;
                  }
                  _this6.start();
                });
              }

              /**
               * On init, insert the cursor element
               * @private
               */
            },
            {
              key: "insertCursor",
              value: function insertCursor() {
                if (!this.showCursor) return;
                if (this.cursor) return;
                this.cursor = document.createElement("span");
                this.cursor.className = "typed-cursor";
                this.cursor.innerHTML = this.cursorChar;
                this.el.parentNode &&
                  this.el.parentNode.insertBefore(this.cursor, this.el.nextSibling);
              }
            }
          ]);

          return Typed;
        })();

        exports["default"] = Typed;
        module.exports = exports["default"];
        window.Typed = Typed;

        /***/
      },
      /* 1 */
      /***/ function(module, exports, __webpack_require__) {
        "use strict";

        Object.defineProperty(exports, "__esModule", {
          value: true
        });

        var _extends =
          Object.assign ||
          function(target) {
            for (var i = 1; i < arguments.length; i++) {
              var source = arguments[i];
              for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
                }
              }
            }
            return target;
          };

        var _createClass = (function() {
          function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
              var descriptor = props[i];
              descriptor.enumerable = descriptor.enumerable || false;
              descriptor.configurable = true;
              if ("value" in descriptor) descriptor.writable = true;
              Object.defineProperty(target, descriptor.key, descriptor);
            }
          }
          return function(Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
          };
        })();

        function _interopRequireDefault(obj) {
          return obj && obj.__esModule ? obj : { default: obj };
        }

        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }

        var _defaultsJs = __webpack_require__(2);

        var _defaultsJs2 = _interopRequireDefault(_defaultsJs);

        /**
         * Initialize the Typed object
         */

        var Initializer = (function() {
          function Initializer() {
            _classCallCheck(this, Initializer);
          }

          _createClass(Initializer, [
            {
              key: "load",

              /**
               * Load up defaults & options on the Typed instance
               * @param {Typed} self instance of Typed
               * @param {object} options options object
               * @param {string} elementId HTML element ID _OR_ instance of HTML element
               * @private
               */

              value: function load(self, options, elementId) {
                // chosen element to manipulate text
                if (typeof elementId === "string") {
                  self.el = document.querySelector(elementId);
                } else {
                  self.el = elementId;
                }

                self.options = _extends({}, _defaultsJs2["default"], options);

                // attribute to type into
                self.isInput = self.el.tagName.toLowerCase() === "input";
                self.attr = self.options.attr;
                self.bindInputFocusEvents = self.options.bindInputFocusEvents;

                // show cursor
                self.showCursor = self.isInput ? false : self.options.showCursor;

                // custom cursor
                self.cursorChar = self.options.cursorChar;

                // Is the cursor blinking
                self.cursorBlinking = true;

                // text content of element
                self.elContent = self.attr ? self.el.getAttribute(self.attr) : self.el.textContent;

                // html or plain text
                self.contentType = self.options.contentType;

                // typing speed
                self.typeSpeed = self.options.typeSpeed;

                // add a delay before typing starts
                self.startDelay = self.options.startDelay;

                // backspacing speed
                self.backSpeed = self.options.backSpeed;

                // only backspace what doesn't match the previous string
                self.smartBackspace = self.options.smartBackspace;

                // amount of time to wait before backspacing
                self.backDelay = self.options.backDelay;

                // Fade out instead of backspace
                self.fadeOut = self.options.fadeOut;
                self.fadeOutClass = self.options.fadeOutClass;
                self.fadeOutDelay = self.options.fadeOutDelay;

                // variable to check whether typing is currently paused
                self.isPaused = false;

                // input strings of text
                self.strings = self.options.strings.map(function(s) {
                  return s.trim();
                });

                // div containing strings
                if (typeof self.options.stringsElement === "string") {
                  self.stringsElement = document.querySelector(self.options.stringsElement);
                } else {
                  self.stringsElement = self.options.stringsElement;
                }

                if (self.stringsElement) {
                  self.strings = [];
                  self.stringsElement.style.display = "none";
                  var strings = Array.prototype.slice.apply(self.stringsElement.children);
                  var stringsLength = strings.length;

                  if (stringsLength) {
                    for (var i = 0; i < stringsLength; i += 1) {
                      var stringEl = strings[i];
                      self.strings.push(stringEl.innerHTML.trim());
                    }
                  }
                }

                // character number position of current string
                self.strPos = 0;

                // current array position
                self.arrayPos = 0;

                // index of string to stop backspacing on
                self.stopNum = 0;

                // Looping logic
                self.loop = self.options.loop;
                self.loopCount = self.options.loopCount;
                self.curLoop = 0;

                // shuffle the strings
                self.shuffle = self.options.shuffle;
                // the order of strings
                self.sequence = [];

                self.pause = {
                  status: false,
                  typewrite: true,
                  curString: "",
                  curStrPos: 0
                };

                // When the typing is complete (when not looped)
                self.typingComplete = false;

                // Set the order in which the strings are typed
                for (var i in self.strings) {
                  self.sequence[i] = i;
                }

                // If there is some text in the element
                self.currentElContent = this.getCurrentElContent(self);

                self.autoInsertCss = self.options.autoInsertCss;

                this.appendAnimationCss(self);
              }
            },
            {
              key: "getCurrentElContent",
              value: function getCurrentElContent(self) {
                var elContent = "";
                if (self.attr) {
                  elContent = self.el.getAttribute(self.attr);
                } else if (self.isInput) {
                  elContent = self.el.value;
                } else if (self.contentType === "html") {
                  elContent = self.el.innerHTML;
                } else {
                  elContent = self.el.textContent;
                }
                return elContent;
              }
            },
            {
              key: "appendAnimationCss",
              value: function appendAnimationCss(self) {
                var cssDataName = "data-typed-js-css";
                if (!self.autoInsertCss) {
                  return;
                }
                if (!self.showCursor && !self.fadeOut) {
                  return;
                }
                if (document.querySelector("[" + cssDataName + "]")) {
                  return;
                }

                var css = document.createElement("style");
                css.type = "text/css";
                css.setAttribute(cssDataName, true);

                var innerCss = "";
                if (self.showCursor) {
                  innerCss +=
                    "\n        .typed-cursor{\n          opacity: 1;\n        }\n        .typed-cursor.typed-cursor--blink{\n          animation: typedjsBlink 0.7s infinite;\n          -webkit-animation: typedjsBlink 0.7s infinite;\n                  animation: typedjsBlink 0.7s infinite;\n        }\n        @keyframes typedjsBlink{\n          50% { opacity: 0.0; }\n        }\n        @-webkit-keyframes typedjsBlink{\n          0% { opacity: 1; }\n          50% { opacity: 0.0; }\n          100% { opacity: 1; }\n        }\n      ";
                }
                if (self.fadeOut) {
                  innerCss +=
                    "\n        .typed-fade-out{\n          opacity: 0;\n          transition: opacity .25s;\n        }\n        .typed-cursor.typed-cursor--blink.typed-fade-out{\n          -webkit-animation: 0;\n          animation: 0;\n        }\n      ";
                }
                if (css.length === 0) {
                  return;
                }
                css.innerHTML = innerCss;
                document.body.appendChild(css);
              }
            }
          ]);

          return Initializer;
        })();

        exports["default"] = Initializer;
        var initializer = new Initializer();
        exports.initializer = initializer;

        /***/
      },
      /* 2 */
      /***/ function(module, exports) {
        /**
         * Defaults & options
         * @returns {object} Typed defaults & options
         * @public
         */

        "use strict";

        Object.defineProperty(exports, "__esModule", {
          value: true
        });
        var defaults = {
          /**
           * @property {array} strings strings to be typed
           * @property {string} stringsElement ID of element containing string children
           */
          strings: [
            "These are the default values...",
            "You know what you should do?",
            "Use your own!",
            "Have a great day!"
          ],
          stringsElement: null,

          /**
           * @property {number} typeSpeed type speed in milliseconds
           */
          typeSpeed: 0,

          /**
           * @property {number} startDelay time before typing starts in milliseconds
           */
          startDelay: 0,

          /**
           * @property {number} backSpeed backspacing speed in milliseconds
           */
          backSpeed: 0,

          /**
           * @property {boolean} smartBackspace only backspace what doesn't match the previous string
           */
          smartBackspace: true,

          /**
           * @property {boolean} shuffle shuffle the strings
           */
          shuffle: false,

          /**
           * @property {number} backDelay time before backspacing in milliseconds
           */
          backDelay: 700,

          /**
           * @property {boolean} fadeOut Fade out instead of backspace
           * @property {string} fadeOutClass css class for fade animation
           * @property {boolean} fadeOutDelay Fade out delay in milliseconds
           */
          fadeOut: false,
          fadeOutClass: "typed-fade-out",
          fadeOutDelay: 500,

          /**
           * @property {boolean} loop loop strings
           * @property {number} loopCount amount of loops
           */
          loop: false,
          loopCount: Infinity,

          /**
           * @property {boolean} showCursor show cursor
           * @property {string} cursorChar character for cursor
           * @property {boolean} autoInsertCss insert CSS for cursor and fadeOut into HTML <head>
           */
          showCursor: true,
          cursorChar: "|",
          autoInsertCss: true,

          /**
           * @property {string} attr attribute for typing
           * Ex: input placeholder, value, or just HTML text
           */
          attr: null,

          /**
           * @property {boolean} bindInputFocusEvents bind to focus and blur if el is text input
           */
          bindInputFocusEvents: false,

          /**
           * @property {string} contentType 'html' or 'null' for plaintext
           */
          contentType: "html",

          /**
           * All typing is complete
           * @param {Typed} self
           */
          onComplete: function onComplete(self) {},

          /**
           * Before each string is typed
           * @param {number} arrayPos
           * @param {Typed} self
           */
          preStringTyped: function preStringTyped(arrayPos, self) {},

          /**
           * After each string is typed
           * @param {number} arrayPos
           * @param {Typed} self
           */
          onStringTyped: function onStringTyped(arrayPos, self) {},

          /**
           * During looping, after last string is typed
           * @param {Typed} self
           */
          onLastStringBackspaced: function onLastStringBackspaced(self) {},

          /**
           * Typing has been stopped
           * @param {number} arrayPos
           * @param {Typed} self
           */
          onTypingPaused: function onTypingPaused(arrayPos, self) {},

          /**
           * Typing has been started after being stopped
           * @param {number} arrayPos
           * @param {Typed} self
           */
          onTypingResumed: function onTypingResumed(arrayPos, self) {},

          /**
           * After reset
           * @param {Typed} self
           */
          onReset: function onReset(self) {},

          /**
           * After stop
           * @param {number} arrayPos
           * @param {Typed} self
           */
          onStop: function onStop(arrayPos, self) {},

          /**
           * After start
           * @param {number} arrayPos
           * @param {Typed} self
           */
          onStart: function onStart(arrayPos, self) {},

          /**
           * After destroy
           * @param {Typed} self
           */
          onDestroy: function onDestroy(self) {}
        };

        exports["default"] = defaults;
        module.exports = exports["default"];

        /***/
      },
      /* 3 */
      /***/ function(module, exports) {
        /**
         * TODO: These methods can probably be combined somehow
         * Parse HTML tags & HTML Characters
         */

        "use strict";

        Object.defineProperty(exports, "__esModule", {
          value: true
        });

        var _createClass = (function() {
          function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
              var descriptor = props[i];
              descriptor.enumerable = descriptor.enumerable || false;
              descriptor.configurable = true;
              if ("value" in descriptor) descriptor.writable = true;
              Object.defineProperty(target, descriptor.key, descriptor);
            }
          }
          return function(Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
          };
        })();

        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }

        var HTMLParser = (function() {
          function HTMLParser() {
            _classCallCheck(this, HTMLParser);
          }

          _createClass(HTMLParser, [
            {
              key: "typeHtmlChars",

              /**
               * Type HTML tags & HTML Characters
               * @param {string} curString Current string
               * @param {number} curStrPos Position in current string
               * @param {Typed} self instance of Typed
               * @returns {number} a new string position
               * @private
               */

              value: function typeHtmlChars(curString, curStrPos, self) {
                if (self.contentType !== "html") return curStrPos;
                var curChar = curString.substr(curStrPos).charAt(0);
                if (curChar === "<" || curChar === "&") {
                  var endTag = "";
                  if (curChar === "<") {
                    endTag = ">";
                  } else {
                    endTag = ";";
                  }
                  while (curString.substr(curStrPos + 1).charAt(0) !== endTag) {
                    curStrPos++;
                    if (curStrPos + 1 > curString.length) {
                      break;
                    }
                  }
                  curStrPos++;
                }
                return curStrPos;
              }

              /**
               * Backspace HTML tags and HTML Characters
               * @param {string} curString Current string
               * @param {number} curStrPos Position in current string
               * @param {Typed} self instance of Typed
               * @returns {number} a new string position
               * @private
               */
            },
            {
              key: "backSpaceHtmlChars",
              value: function backSpaceHtmlChars(curString, curStrPos, self) {
                if (self.contentType !== "html") return curStrPos;
                var curChar = curString.substr(curStrPos).charAt(0);
                if (curChar === ">" || curChar === ";") {
                  var endTag = "";
                  if (curChar === ">") {
                    endTag = "<";
                  } else {
                    endTag = "&";
                  }
                  while (curString.substr(curStrPos - 1).charAt(0) !== endTag) {
                    curStrPos--;
                    if (curStrPos < 0) {
                      break;
                    }
                  }
                  curStrPos--;
                }
                return curStrPos;
              }
            }
          ]);

          return HTMLParser;
        })();

        exports["default"] = HTMLParser;
        var htmlParser = new HTMLParser();
        exports.htmlParser = htmlParser;

        /***/
      }
      /******/
    ]
  );
});
/*! Magnific Popup - v1.1.0 - 2016-02-20
 * http://dimsemenov.com/plugins/magnific-popup/
 * Copyright (c) 2016 Dmitry Semenov; */
(function(factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define(["jquery"], factory);
  } else if (typeof exports === "object") {
    // Node/CommonJS
    factory(require("jquery"));
  } else {
    // Browser globals
    factory(window.jQuery || window.Zepto);
  }
})(function($) {
  /*>>core*/
  /**
   *
   * Magnific Popup Core JS file
   *
   */

  /**
   * Private static constants
   */
  var CLOSE_EVENT = "Close",
    BEFORE_CLOSE_EVENT = "BeforeClose",
    AFTER_CLOSE_EVENT = "AfterClose",
    BEFORE_APPEND_EVENT = "BeforeAppend",
    MARKUP_PARSE_EVENT = "MarkupParse",
    OPEN_EVENT = "Open",
    CHANGE_EVENT = "Change",
    NS = "mfp",
    EVENT_NS = "." + NS,
    READY_CLASS = "mfp-ready",
    REMOVING_CLASS = "mfp-removing",
    PREVENT_CLOSE_CLASS = "mfp-prevent-close";

  /**
   * Private vars
   */
  /*jshint -W079 */
  var mfp, // As we have only one instance of MagnificPopup object, we define it locally to not to use 'this'
    MagnificPopup = function() {},
    _isJQ = !!window.jQuery,
    _prevStatus,
    _window = $(window),
    _document,
    _prevContentType,
    _wrapClasses,
    _currPopupType;

  /**
   * Private functions
   */
  var _mfpOn = function(name, f) {
      mfp.ev.on(NS + name + EVENT_NS, f);
    },
    _getEl = function(className, appendTo, html, raw) {
      var el = document.createElement("div");
      el.className = "mfp-" + className;
      if (html) {
        el.innerHTML = html;
      }
      if (!raw) {
        el = $(el);
        if (appendTo) {
          el.appendTo(appendTo);
        }
      } else if (appendTo) {
        appendTo.appendChild(el);
      }
      return el;
    },
    _mfpTrigger = function(e, data) {
      mfp.ev.triggerHandler(NS + e, data);

      if (mfp.st.callbacks) {
        // converts "mfpEventName" to "eventName" callback and triggers it if it's present
        e = e.charAt(0).toLowerCase() + e.slice(1);
        if (mfp.st.callbacks[e]) {
          mfp.st.callbacks[e].apply(mfp, $.isArray(data) ? data : [data]);
        }
      }
    },
    _getCloseBtn = function(type) {
      if (type !== _currPopupType || !mfp.currTemplate.closeBtn) {
        mfp.currTemplate.closeBtn = $(mfp.st.closeMarkup.replace("%title%", mfp.st.tClose));
        _currPopupType = type;
      }
      return mfp.currTemplate.closeBtn;
    },
    // Initialize Magnific Popup only when called at least once
    _checkInstance = function() {
      if (!$.magnificPopup.instance) {
        /*jshint -W020 */
        mfp = new MagnificPopup();
        mfp.init();
        $.magnificPopup.instance = mfp;
      }
    },
    // CSS transition detection, http://stackoverflow.com/questions/7264899/detect-css-transitions-using-javascript-and-without-modernizr
    supportsTransitions = function() {
      var s = document.createElement("p").style, // 's' for style. better to create an element if body yet to exist
        v = ["ms", "O", "Moz", "Webkit"]; // 'v' for vendor

      if (s["transition"] !== undefined) {
        return true;
      }

      while (v.length) {
        if (v.pop() + "Transition" in s) {
          return true;
        }
      }

      return false;
    };

  /**
   * Public functions
   */
  MagnificPopup.prototype = {
    constructor: MagnificPopup,

    /**
     * Initializes Magnific Popup plugin.
     * This function is triggered only once when $.fn.magnificPopup or $.magnificPopup is executed
     */
    init: function() {
      var appVersion = navigator.appVersion;
      mfp.isLowIE = mfp.isIE8 = document.all && !document.addEventListener;
      mfp.isAndroid = /android/gi.test(appVersion);
      mfp.isIOS = /iphone|ipad|ipod/gi.test(appVersion);
      mfp.supportsTransition = supportsTransitions();

      // We disable fixed positioned lightbox on devices that don't handle it nicely.
      // If you know a better way of detecting this - let me know.
      mfp.probablyMobile =
        mfp.isAndroid ||
        mfp.isIOS ||
        /(Opera Mini)|Kindle|webOS|BlackBerry|(Opera Mobi)|(Windows Phone)|IEMobile/i.test(
          navigator.userAgent
        );
      _document = $(document);

      mfp.popupsCache = {};
    },

    /**
     * Opens popup
     * @param  data [description]
     */
    open: function(data) {
      var i;

      if (data.isObj === false) {
        // convert jQuery collection to array to avoid conflicts later
        mfp.items = data.items.toArray();

        mfp.index = 0;
        var items = data.items,
          item;
        for (i = 0; i < items.length; i++) {
          item = items[i];
          if (item.parsed) {
            item = item.el[0];
          }
          if (item === data.el[0]) {
            mfp.index = i;
            break;
          }
        }
      } else {
        mfp.items = $.isArray(data.items) ? data.items : [data.items];
        mfp.index = data.index || 0;
      }

      // if popup is already opened - we just update the content
      if (mfp.isOpen) {
        mfp.updateItemHTML();
        return;
      }

      mfp.types = [];
      _wrapClasses = "";
      if (data.mainEl && data.mainEl.length) {
        mfp.ev = data.mainEl.eq(0);
      } else {
        mfp.ev = _document;
      }

      if (data.key) {
        if (!mfp.popupsCache[data.key]) {
          mfp.popupsCache[data.key] = {};
        }
        mfp.currTemplate = mfp.popupsCache[data.key];
      } else {
        mfp.currTemplate = {};
      }

      mfp.st = $.extend(true, {}, $.magnificPopup.defaults, data);
      mfp.fixedContentPos =
        mfp.st.fixedContentPos === "auto" ? !mfp.probablyMobile : mfp.st.fixedContentPos;

      if (mfp.st.modal) {
        mfp.st.closeOnContentClick = false;
        mfp.st.closeOnBgClick = false;
        mfp.st.showCloseBtn = false;
        mfp.st.enableEscapeKey = false;
      }

      // Building markup
      // main containers are created only once
      if (!mfp.bgOverlay) {
        // Dark overlay
        mfp.bgOverlay = _getEl("bg").on("click" + EVENT_NS, function() {
          mfp.close();
        });

        mfp.wrap = _getEl("wrap")
          .attr("tabindex", -1)
          .on("click" + EVENT_NS, function(e) {
            if (mfp._checkIfClose(e.target)) {
              mfp.close();
            }
          });

        mfp.container = _getEl("container", mfp.wrap);
      }

      mfp.contentContainer = _getEl("content");
      if (mfp.st.preloader) {
        mfp.preloader = _getEl("preloader", mfp.container, mfp.st.tLoading);
      }

      // Initializing modules
      var modules = $.magnificPopup.modules;
      for (i = 0; i < modules.length; i++) {
        var n = modules[i];
        n = n.charAt(0).toUpperCase() + n.slice(1);
        mfp["init" + n].call(mfp);
      }
      _mfpTrigger("BeforeOpen");

      if (mfp.st.showCloseBtn) {
        // Close button
        if (!mfp.st.closeBtnInside) {
          mfp.wrap.append(_getCloseBtn());
        } else {
          _mfpOn(MARKUP_PARSE_EVENT, function(e, template, values, item) {
            values.close_replaceWith = _getCloseBtn(item.type);
          });
          _wrapClasses += " mfp-close-btn-in";
        }
      }

      if (mfp.st.alignTop) {
        _wrapClasses += " mfp-align-top";
      }

      if (mfp.fixedContentPos) {
        mfp.wrap.css({
          overflow: mfp.st.overflowY,
          overflowX: "hidden",
          overflowY: mfp.st.overflowY
        });
      } else {
        mfp.wrap.css({
          top: _window.scrollTop(),
          position: "absolute"
        });
      }
      if (mfp.st.fixedBgPos === false || (mfp.st.fixedBgPos === "auto" && !mfp.fixedContentPos)) {
        mfp.bgOverlay.css({
          height: _document.height(),
          position: "absolute"
        });
      }

      if (mfp.st.enableEscapeKey) {
        // Close on ESC key
        _document.on("keyup" + EVENT_NS, function(e) {
          if (e.keyCode === 27) {
            mfp.close();
          }
        });
      }

      _window.on("resize" + EVENT_NS, function() {
        mfp.updateSize();
      });

      if (!mfp.st.closeOnContentClick) {
        _wrapClasses += " mfp-auto-cursor";
      }

      if (_wrapClasses) mfp.wrap.addClass(_wrapClasses);

      // this triggers recalculation of layout, so we get it once to not to trigger twice
      var windowHeight = (mfp.wH = _window.height());

      var windowStyles = {};

      if (mfp.fixedContentPos) {
        if (mfp._hasScrollBar(windowHeight)) {
          var s = mfp._getScrollbarSize();
          if (s) {
            windowStyles.marginRight = s;
          }
        }
      }

      if (mfp.fixedContentPos) {
        if (!mfp.isIE7) {
          windowStyles.overflow = "hidden";
        } else {
          // ie7 double-scroll bug
          $("body, html").css("overflow", "hidden");
        }
      }

      var classesToadd = mfp.st.mainClass;
      if (mfp.isIE7) {
        classesToadd += " mfp-ie7";
      }
      if (classesToadd) {
        mfp._addClassToMFP(classesToadd);
      }

      // add content
      mfp.updateItemHTML();

      _mfpTrigger("BuildControls");

      // remove scrollbar, add margin e.t.c
      $("html").css(windowStyles);

      // add everything to DOM
      mfp.bgOverlay.add(mfp.wrap).prependTo(mfp.st.prependTo || $(document.body));

      // Save last focused element
      mfp._lastFocusedEl = document.activeElement;

      // Wait for next cycle to allow CSS transition
      setTimeout(function() {
        if (mfp.content) {
          mfp._addClassToMFP(READY_CLASS);
          mfp._setFocus();
        } else {
          // if content is not defined (not loaded e.t.c) we add class only for BG
          mfp.bgOverlay.addClass(READY_CLASS);
        }

        // Trap the focus in popup
        _document.on("focusin" + EVENT_NS, mfp._onFocusIn);
      }, 16);

      mfp.isOpen = true;
      mfp.updateSize(windowHeight);
      _mfpTrigger(OPEN_EVENT);

      return data;
    },

    /**
     * Closes the popup
     */
    close: function() {
      if (!mfp.isOpen) return;
      _mfpTrigger(BEFORE_CLOSE_EVENT);

      mfp.isOpen = false;
      // for CSS3 animation
      if (mfp.st.removalDelay && !mfp.isLowIE && mfp.supportsTransition) {
        mfp._addClassToMFP(REMOVING_CLASS);
        setTimeout(function() {
          mfp._close();
        }, mfp.st.removalDelay);
      } else {
        mfp._close();
      }
    },

    /**
     * Helper for close() function
     */
    _close: function() {
      _mfpTrigger(CLOSE_EVENT);

      var classesToRemove = REMOVING_CLASS + " " + READY_CLASS + " ";

      mfp.bgOverlay.detach();
      mfp.wrap.detach();
      mfp.container.empty();

      if (mfp.st.mainClass) {
        classesToRemove += mfp.st.mainClass + " ";
      }

      mfp._removeClassFromMFP(classesToRemove);

      if (mfp.fixedContentPos) {
        var windowStyles = { marginRight: "" };
        if (mfp.isIE7) {
          $("body, html").css("overflow", "");
        } else {
          windowStyles.overflow = "";
        }
        $("html").css(windowStyles);
      }

      _document.off("keyup" + EVENT_NS + " focusin" + EVENT_NS);
      mfp.ev.off(EVENT_NS);

      // clean up DOM elements that aren't removed
      mfp.wrap.attr("class", "mfp-wrap").removeAttr("style");
      mfp.bgOverlay.attr("class", "mfp-bg");
      mfp.container.attr("class", "mfp-container");

      // remove close button from target element
      if (
        mfp.st.showCloseBtn &&
        (!mfp.st.closeBtnInside || mfp.currTemplate[mfp.currItem.type] === true)
      ) {
        if (mfp.currTemplate.closeBtn) mfp.currTemplate.closeBtn.detach();
      }

      if (mfp.st.autoFocusLast && mfp._lastFocusedEl) {
        $(mfp._lastFocusedEl).focus(); // put tab focus back
      }
      mfp.currItem = null;
      mfp.content = null;
      mfp.currTemplate = null;
      mfp.prevHeight = 0;

      _mfpTrigger(AFTER_CLOSE_EVENT);
    },

    updateSize: function(winHeight) {
      if (mfp.isIOS) {
        // fixes iOS nav bars https://github.com/dimsemenov/Magnific-Popup/issues/2
        var zoomLevel = document.documentElement.clientWidth / window.innerWidth;
        var height = window.innerHeight * zoomLevel;
        mfp.wrap.css("height", height);
        mfp.wH = height;
      } else {
        mfp.wH = winHeight || _window.height();
      }
      // Fixes #84: popup incorrectly positioned with position:relative on body
      if (!mfp.fixedContentPos) {
        mfp.wrap.css("height", mfp.wH);
      }

      _mfpTrigger("Resize");
    },

    /**
     * Set content of popup based on current index
     */
    updateItemHTML: function() {
      var item = mfp.items[mfp.index];

      // Detach and perform modifications
      mfp.contentContainer.detach();

      if (mfp.content) mfp.content.detach();

      if (!item.parsed) {
        item = mfp.parseEl(mfp.index);
      }

      var type = item.type;

      _mfpTrigger("BeforeChange", [mfp.currItem ? mfp.currItem.type : "", type]);
      // BeforeChange event works like so:
      // _mfpOn('BeforeChange', function(e, prevType, newType) { });

      mfp.currItem = item;

      if (!mfp.currTemplate[type]) {
        var markup = mfp.st[type] ? mfp.st[type].markup : false;

        // allows to modify markup
        _mfpTrigger("FirstMarkupParse", markup);

        if (markup) {
          mfp.currTemplate[type] = $(markup);
        } else {
          // if there is no markup found we just define that template is parsed
          mfp.currTemplate[type] = true;
        }
      }

      if (_prevContentType && _prevContentType !== item.type) {
        mfp.container.removeClass("mfp-" + _prevContentType + "-holder");
      }

      var newContent = mfp["get" + type.charAt(0).toUpperCase() + type.slice(1)](
        item,
        mfp.currTemplate[type]
      );
      mfp.appendContent(newContent, type);

      item.preloaded = true;

      _mfpTrigger(CHANGE_EVENT, item);
      _prevContentType = item.type;

      // Append container back after its content changed
      mfp.container.prepend(mfp.contentContainer);

      _mfpTrigger("AfterChange");
    },

    /**
     * Set HTML content of popup
     */
    appendContent: function(newContent, type) {
      mfp.content = newContent;

      if (newContent) {
        if (mfp.st.showCloseBtn && mfp.st.closeBtnInside && mfp.currTemplate[type] === true) {
          // if there is no markup, we just append close button element inside
          if (!mfp.content.find(".mfp-close").length) {
            mfp.content.append(_getCloseBtn());
          }
        } else {
          mfp.content = newContent;
        }
      } else {
        mfp.content = "";
      }

      _mfpTrigger(BEFORE_APPEND_EVENT);
      mfp.container.addClass("mfp-" + type + "-holder");

      mfp.contentContainer.append(mfp.content);
    },

    /**
     * Creates Magnific Popup data object based on given data
     * @param  {int} index Index of item to parse
     */
    parseEl: function(index) {
      var item = mfp.items[index],
        type;

      if (item.tagName) {
        item = { el: $(item) };
      } else {
        type = item.type;
        item = { data: item, src: item.src };
      }

      if (item.el) {
        var types = mfp.types;

        // check for 'mfp-TYPE' class
        for (var i = 0; i < types.length; i++) {
          if (item.el.hasClass("mfp-" + types[i])) {
            type = types[i];
            break;
          }
        }

        item.src = item.el.attr("data-mfp-src");
        if (!item.src) {
          item.src = item.el.attr("href");
        }
      }

      item.type = type || mfp.st.type || "inline";
      item.index = index;
      item.parsed = true;
      mfp.items[index] = item;
      _mfpTrigger("ElementParse", item);

      return mfp.items[index];
    },

    /**
     * Initializes single popup or a group of popups
     */
    addGroup: function(el, options) {
      var eHandler = function(e) {
        e.mfpEl = this;
        mfp._openClick(e, el, options);
      };

      if (!options) {
        options = {};
      }

      var eName = "click.magnificPopup";
      options.mainEl = el;

      if (options.items) {
        options.isObj = true;
        el.off(eName).on(eName, eHandler);
      } else {
        options.isObj = false;
        if (options.delegate) {
          el.off(eName).on(eName, options.delegate, eHandler);
        } else {
          options.items = el;
          el.off(eName).on(eName, eHandler);
        }
      }
    },
    _openClick: function(e, el, options) {
      var midClick =
        options.midClick !== undefined ? options.midClick : $.magnificPopup.defaults.midClick;

      if (!midClick && (e.which === 2 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) {
        return;
      }

      var disableOn =
        options.disableOn !== undefined ? options.disableOn : $.magnificPopup.defaults.disableOn;

      if (disableOn) {
        if ($.isFunction(disableOn)) {
          if (!disableOn.call(mfp)) {
            return true;
          }
        } else {
          // else it's number
          if (_window.width() < disableOn) {
            return true;
          }
        }
      }

      if (e.type) {
        e.preventDefault();

        // This will prevent popup from closing if element is inside and popup is already opened
        if (mfp.isOpen) {
          e.stopPropagation();
        }
      }

      options.el = $(e.mfpEl);
      if (options.delegate) {
        options.items = el.find(options.delegate);
      }
      mfp.open(options);
    },

    /**
     * Updates text on preloader
     */
    updateStatus: function(status, text) {
      if (mfp.preloader) {
        if (_prevStatus !== status) {
          mfp.container.removeClass("mfp-s-" + _prevStatus);
        }

        if (!text && status === "loading") {
          text = mfp.st.tLoading;
        }

        var data = {
          status: status,
          text: text
        };
        // allows to modify status
        _mfpTrigger("UpdateStatus", data);

        status = data.status;
        text = data.text;

        mfp.preloader.html(text);

        mfp.preloader.find("a").on("click", function(e) {
          e.stopImmediatePropagation();
        });

        mfp.container.addClass("mfp-s-" + status);
        _prevStatus = status;
      }
    },

    /*
		"Private" helpers that aren't private at all
	 */
    // Check to close popup or not
    // "target" is an element that was clicked
    _checkIfClose: function(target) {
      if ($(target).hasClass(PREVENT_CLOSE_CLASS)) {
        return;
      }

      var closeOnContent = mfp.st.closeOnContentClick;
      var closeOnBg = mfp.st.closeOnBgClick;

      if (closeOnContent && closeOnBg) {
        return true;
      } else {
        // We close the popup if click is on close button or on preloader. Or if there is no content.
        if (
          !mfp.content ||
          $(target).hasClass("mfp-close") ||
          (mfp.preloader && target === mfp.preloader[0])
        ) {
          return true;
        }

        // if click is outside the content
        if (target !== mfp.content[0] && !$.contains(mfp.content[0], target)) {
          if (closeOnBg) {
            // last check, if the clicked element is in DOM, (in case it's removed onclick)
            if ($.contains(document, target)) {
              return true;
            }
          }
        } else if (closeOnContent) {
          return true;
        }
      }
      return false;
    },
    _addClassToMFP: function(cName) {
      mfp.bgOverlay.addClass(cName);
      mfp.wrap.addClass(cName);
    },
    _removeClassFromMFP: function(cName) {
      this.bgOverlay.removeClass(cName);
      mfp.wrap.removeClass(cName);
    },
    _hasScrollBar: function(winHeight) {
      return (
        (mfp.isIE7 ? _document.height() : document.body.scrollHeight) >
        (winHeight || _window.height())
      );
    },
    _setFocus: function() {
      (mfp.st.focus ? mfp.content.find(mfp.st.focus).eq(0) : mfp.wrap).focus();
    },
    _onFocusIn: function(e) {
      if (e.target !== mfp.wrap[0] && !$.contains(mfp.wrap[0], e.target)) {
        mfp._setFocus();
        return false;
      }
    },
    _parseMarkup: function(template, values, item) {
      var arr;
      if (item.data) {
        values = $.extend(item.data, values);
      }
      _mfpTrigger(MARKUP_PARSE_EVENT, [template, values, item]);

      $.each(values, function(key, value) {
        if (value === undefined || value === false) {
          return true;
        }
        arr = key.split("_");
        if (arr.length > 1) {
          var el = template.find(EVENT_NS + "-" + arr[0]);

          if (el.length > 0) {
            var attr = arr[1];
            if (attr === "replaceWith") {
              if (el[0] !== value[0]) {
                el.replaceWith(value);
              }
            } else if (attr === "img") {
              if (el.is("img")) {
                el.attr("src", value);
              } else {
                el.replaceWith(
                  $("<img>")
                    .attr("src", value)
                    .attr("class", el.attr("class"))
                );
              }
            } else {
              el.attr(arr[1], value);
            }
          }
        } else {
          template.find(EVENT_NS + "-" + key).html(value);
        }
      });
    },

    _getScrollbarSize: function() {
      // thx David
      if (mfp.scrollbarSize === undefined) {
        var scrollDiv = document.createElement("div");
        scrollDiv.style.cssText =
          "width: 99px; height: 99px; overflow: scroll; position: absolute; top: -9999px;";
        document.body.appendChild(scrollDiv);
        mfp.scrollbarSize = scrollDiv.offsetWidth - scrollDiv.clientWidth;
        document.body.removeChild(scrollDiv);
      }
      return mfp.scrollbarSize;
    }
  }; /* MagnificPopup core prototype end */

  /**
   * Public static functions
   */
  $.magnificPopup = {
    instance: null,
    proto: MagnificPopup.prototype,
    modules: [],

    open: function(options, index) {
      _checkInstance();

      if (!options) {
        options = {};
      } else {
        options = $.extend(true, {}, options);
      }

      options.isObj = true;
      options.index = index || 0;
      return this.instance.open(options);
    },

    close: function() {
      return $.magnificPopup.instance && $.magnificPopup.instance.close();
    },

    registerModule: function(name, module) {
      if (module.options) {
        $.magnificPopup.defaults[name] = module.options;
      }
      $.extend(this.proto, module.proto);
      this.modules.push(name);
    },

    defaults: {
      // Info about options is in docs:
      // http://dimsemenov.com/plugins/magnific-popup/documentation.html#options

      disableOn: 0,

      key: null,

      midClick: false,

      mainClass: "",

      preloader: true,

      focus: "", // CSS selector of input to focus after popup is opened

      closeOnContentClick: false,

      closeOnBgClick: true,

      closeBtnInside: true,

      showCloseBtn: true,

      enableEscapeKey: true,

      modal: false,

      alignTop: false,

      removalDelay: 0,

      prependTo: null,

      fixedContentPos: "auto",

      fixedBgPos: "auto",

      overflowY: "auto",

      closeMarkup: '<button title="%title%" type="button" class="mfp-close">&#215;</button>',

      tClose: "Close (Esc)",

      tLoading: "Loading...",

      autoFocusLast: true
    }
  };

  $.fn.magnificPopup = function(options) {
    _checkInstance();

    var jqEl = $(this);

    // We call some API method of first param is a string
    if (typeof options === "string") {
      if (options === "open") {
        var items,
          itemOpts = _isJQ ? jqEl.data("magnificPopup") : jqEl[0].magnificPopup,
          index = parseInt(arguments[1], 10) || 0;

        if (itemOpts.items) {
          items = itemOpts.items[index];
        } else {
          items = jqEl;
          if (itemOpts.delegate) {
            items = items.find(itemOpts.delegate);
          }
          items = items.eq(index);
        }
        mfp._openClick({ mfpEl: items }, jqEl, itemOpts);
      } else {
        if (mfp.isOpen) mfp[options].apply(mfp, Array.prototype.slice.call(arguments, 1));
      }
    } else {
      // clone options obj
      options = $.extend(true, {}, options);

      /*
       * As Zepto doesn't support .data() method for objects
       * and it works only in normal browsers
       * we assign "options" object directly to the DOM element. FTW!
       */
      if (_isJQ) {
        jqEl.data("magnificPopup", options);
      } else {
        jqEl[0].magnificPopup = options;
      }

      mfp.addGroup(jqEl, options);
    }
    return jqEl;
  };

  /*>>core*/

  /*>>inline*/

  var INLINE_NS = "inline",
    _hiddenClass,
    _inlinePlaceholder,
    _lastInlineElement,
    _putInlineElementsBack = function() {
      if (_lastInlineElement) {
        _inlinePlaceholder.after(_lastInlineElement.addClass(_hiddenClass)).detach();
        _lastInlineElement = null;
      }
    };

  $.magnificPopup.registerModule(INLINE_NS, {
    options: {
      hiddenClass: "hide", // will be appended with `mfp-` prefix
      markup: "",
      tNotFound: "Content not found"
    },
    proto: {
      initInline: function() {
        mfp.types.push(INLINE_NS);

        _mfpOn(CLOSE_EVENT + "." + INLINE_NS, function() {
          _putInlineElementsBack();
        });
      },

      getInline: function(item, template) {
        _putInlineElementsBack();

        if (item.src) {
          var inlineSt = mfp.st.inline,
            el = $(item.src);

          if (el.length) {
            // If target element has parent - we replace it with placeholder and put it back after popup is closed
            var parent = el[0].parentNode;
            if (parent && parent.tagName) {
              if (!_inlinePlaceholder) {
                _hiddenClass = inlineSt.hiddenClass;
                _inlinePlaceholder = _getEl(_hiddenClass);
                _hiddenClass = "mfp-" + _hiddenClass;
              }
              // replace target inline element with placeholder
              _lastInlineElement = el
                .after(_inlinePlaceholder)
                .detach()
                .removeClass(_hiddenClass);
            }

            mfp.updateStatus("ready");
          } else {
            mfp.updateStatus("error", inlineSt.tNotFound);
            el = $("<div>");
          }

          item.inlineElement = el;
          return el;
        }

        mfp.updateStatus("ready");
        mfp._parseMarkup(template, {}, item);
        return template;
      }
    }
  });

  /*>>inline*/

  /*>>ajax*/
  var AJAX_NS = "ajax",
    _ajaxCur,
    _removeAjaxCursor = function() {
      if (_ajaxCur) {
        $(document.body).removeClass(_ajaxCur);
      }
    },
    _destroyAjaxRequest = function() {
      _removeAjaxCursor();
      if (mfp.req) {
        mfp.req.abort();
      }
    };

  $.magnificPopup.registerModule(AJAX_NS, {
    options: {
      settings: null,
      cursor: "mfp-ajax-cur",
      tError: '<a href="%url%">The content</a> could not be loaded.'
    },

    proto: {
      initAjax: function() {
        mfp.types.push(AJAX_NS);
        _ajaxCur = mfp.st.ajax.cursor;

        _mfpOn(CLOSE_EVENT + "." + AJAX_NS, _destroyAjaxRequest);
        _mfpOn("BeforeChange." + AJAX_NS, _destroyAjaxRequest);
      },
      getAjax: function(item) {
        if (_ajaxCur) {
          $(document.body).addClass(_ajaxCur);
        }

        mfp.updateStatus("loading");

        var opts = $.extend(
          {
            url: item.src,
            success: function(data, textStatus, jqXHR) {
              var temp = {
                data: data,
                xhr: jqXHR
              };

              _mfpTrigger("ParseAjax", temp);

              mfp.appendContent($(temp.data), AJAX_NS);

              item.finished = true;

              _removeAjaxCursor();

              mfp._setFocus();

              setTimeout(function() {
                mfp.wrap.addClass(READY_CLASS);
              }, 16);

              mfp.updateStatus("ready");

              _mfpTrigger("AjaxContentAdded");
            },
            error: function() {
              _removeAjaxCursor();
              item.finished = item.loadError = true;
              mfp.updateStatus("error", mfp.st.ajax.tError.replace("%url%", item.src));
            }
          },
          mfp.st.ajax.settings
        );

        mfp.req = $.ajax(opts);

        return "";
      }
    }
  });

  /*>>ajax*/

  /*>>image*/
  var _imgInterval,
    _getTitle = function(item) {
      if (item.data && item.data.title !== undefined) return item.data.title;

      var src = mfp.st.image.titleSrc;

      if (src) {
        if ($.isFunction(src)) {
          return src.call(mfp, item);
        } else if (item.el) {
          return item.el.attr(src) || "";
        }
      }
      return "";
    };

  $.magnificPopup.registerModule("image", {
    options: {
      markup:
        '<div class="mfp-figure">' +
        '<div class="mfp-close"></div>' +
        "<figure>" +
        '<div class="mfp-img"></div>' +
        "<figcaption>" +
        '<div class="mfp-bottom-bar">' +
        '<div class="mfp-title"></div>' +
        '<div class="mfp-counter"></div>' +
        "</div>" +
        "</figcaption>" +
        "</figure>" +
        "</div>",
      cursor: "mfp-zoom-out-cur",
      titleSrc: "title",
      verticalFit: true,
      tError: '<a href="%url%">The image</a> could not be loaded.'
    },

    proto: {
      initImage: function() {
        var imgSt = mfp.st.image,
          ns = ".image";

        mfp.types.push("image");

        _mfpOn(OPEN_EVENT + ns, function() {
          if (mfp.currItem.type === "image" && imgSt.cursor) {
            $(document.body).addClass(imgSt.cursor);
          }
        });

        _mfpOn(CLOSE_EVENT + ns, function() {
          if (imgSt.cursor) {
            $(document.body).removeClass(imgSt.cursor);
          }
          _window.off("resize" + EVENT_NS);
        });

        _mfpOn("Resize" + ns, mfp.resizeImage);
        if (mfp.isLowIE) {
          _mfpOn("AfterChange", mfp.resizeImage);
        }
      },
      resizeImage: function() {
        var item = mfp.currItem;
        if (!item || !item.img) return;

        if (mfp.st.image.verticalFit) {
          var decr = 0;
          // fix box-sizing in ie7/8
          if (mfp.isLowIE) {
            decr =
              parseInt(item.img.css("padding-top"), 10) +
              parseInt(item.img.css("padding-bottom"), 10);
          }
          item.img.css("max-height", mfp.wH - decr);
        }
      },
      _onImageHasSize: function(item) {
        if (item.img) {
          item.hasSize = true;

          if (_imgInterval) {
            clearInterval(_imgInterval);
          }

          item.isCheckingImgSize = false;

          _mfpTrigger("ImageHasSize", item);

          if (item.imgHidden) {
            if (mfp.content) mfp.content.removeClass("mfp-loading");

            item.imgHidden = false;
          }
        }
      },

      /**
       * Function that loops until the image has size to display elements that rely on it asap
       */
      findImageSize: function(item) {
        var counter = 0,
          img = item.img[0],
          mfpSetInterval = function(delay) {
            if (_imgInterval) {
              clearInterval(_imgInterval);
            }
            // decelerating interval that checks for size of an image
            _imgInterval = setInterval(function() {
              if (img.naturalWidth > 0) {
                mfp._onImageHasSize(item);
                return;
              }

              if (counter > 200) {
                clearInterval(_imgInterval);
              }

              counter++;
              if (counter === 3) {
                mfpSetInterval(10);
              } else if (counter === 40) {
                mfpSetInterval(50);
              } else if (counter === 100) {
                mfpSetInterval(500);
              }
            }, delay);
          };

        mfpSetInterval(1);
      },

      getImage: function(item, template) {
        var guard = 0,
          // image load complete handler
          onLoadComplete = function() {
            if (item) {
              if (item.img[0].complete) {
                item.img.off(".mfploader");

                if (item === mfp.currItem) {
                  mfp._onImageHasSize(item);

                  mfp.updateStatus("ready");
                }

                item.hasSize = true;
                item.loaded = true;

                _mfpTrigger("ImageLoadComplete");
              } else {
                // if image complete check fails 200 times (20 sec), we assume that there was an error.
                guard++;
                if (guard < 200) {
                  setTimeout(onLoadComplete, 100);
                } else {
                  onLoadError();
                }
              }
            }
          },
          // image error handler
          onLoadError = function() {
            if (item) {
              item.img.off(".mfploader");
              if (item === mfp.currItem) {
                mfp._onImageHasSize(item);
                mfp.updateStatus("error", imgSt.tError.replace("%url%", item.src));
              }

              item.hasSize = true;
              item.loaded = true;
              item.loadError = true;
            }
          },
          imgSt = mfp.st.image;

        var el = template.find(".mfp-img");
        if (el.length) {
          var img = document.createElement("img");
          img.className = "mfp-img";
          if (item.el && item.el.find("img").length) {
            img.alt = item.el.find("img").attr("alt");
          }
          item.img = $(img)
            .on("load.mfploader", onLoadComplete)
            .on("error.mfploader", onLoadError);
          img.src = item.src;

          // without clone() "error" event is not firing when IMG is replaced by new IMG
          // TODO: find a way to avoid such cloning
          if (el.is("img")) {
            item.img = item.img.clone();
          }

          img = item.img[0];
          if (img.naturalWidth > 0) {
            item.hasSize = true;
          } else if (!img.width) {
            item.hasSize = false;
          }
        }

        mfp._parseMarkup(
          template,
          {
            title: _getTitle(item),
            img_replaceWith: item.img
          },
          item
        );

        mfp.resizeImage();

        if (item.hasSize) {
          if (_imgInterval) clearInterval(_imgInterval);

          if (item.loadError) {
            template.addClass("mfp-loading");
            mfp.updateStatus("error", imgSt.tError.replace("%url%", item.src));
          } else {
            template.removeClass("mfp-loading");
            mfp.updateStatus("ready");
          }
          return template;
        }

        mfp.updateStatus("loading");
        item.loading = true;

        if (!item.hasSize) {
          item.imgHidden = true;
          template.addClass("mfp-loading");
          mfp.findImageSize(item);
        }

        return template;
      }
    }
  });

  /*>>image*/

  /*>>zoom*/
  var hasMozTransform,
    getHasMozTransform = function() {
      if (hasMozTransform === undefined) {
        hasMozTransform = document.createElement("p").style.MozTransform !== undefined;
      }
      return hasMozTransform;
    };

  $.magnificPopup.registerModule("zoom", {
    options: {
      enabled: false,
      easing: "ease-in-out",
      duration: 300,
      opener: function(element) {
        return element.is("img") ? element : element.find("img");
      }
    },

    proto: {
      initZoom: function() {
        var zoomSt = mfp.st.zoom,
          ns = ".zoom",
          image;

        if (!zoomSt.enabled || !mfp.supportsTransition) {
          return;
        }

        var duration = zoomSt.duration,
          getElToAnimate = function(image) {
            var newImg = image
                .clone()
                .removeAttr("style")
                .removeAttr("class")
                .addClass("mfp-animated-image"),
              transition = "all " + zoomSt.duration / 1000 + "s " + zoomSt.easing,
              cssObj = {
                position: "fixed",
                zIndex: 9999,
                left: 0,
                top: 0,
                "-webkit-backface-visibility": "hidden"
              },
              t = "transition";

            cssObj["-webkit-" + t] = cssObj["-moz-" + t] = cssObj["-o-" + t] = cssObj[
              t
            ] = transition;

            newImg.css(cssObj);
            return newImg;
          },
          showMainContent = function() {
            mfp.content.css("visibility", "visible");
          },
          openTimeout,
          animatedImg;

        _mfpOn("BuildControls" + ns, function() {
          if (mfp._allowZoom()) {
            clearTimeout(openTimeout);
            mfp.content.css("visibility", "hidden");

            // Basically, all code below does is clones existing image, puts in on top of the current one and animated it

            image = mfp._getItemToZoom();

            if (!image) {
              showMainContent();
              return;
            }

            animatedImg = getElToAnimate(image);

            animatedImg.css(mfp._getOffset());

            mfp.wrap.append(animatedImg);

            openTimeout = setTimeout(function() {
              animatedImg.css(mfp._getOffset(true));
              openTimeout = setTimeout(function() {
                showMainContent();

                setTimeout(function() {
                  animatedImg.remove();
                  image = animatedImg = null;
                  _mfpTrigger("ZoomAnimationEnded");
                }, 16); // avoid blink when switching images
              }, duration); // this timeout equals animation duration
            }, 16); // by adding this timeout we avoid short glitch at the beginning of animation

            // Lots of timeouts...
          }
        });
        _mfpOn(BEFORE_CLOSE_EVENT + ns, function() {
          if (mfp._allowZoom()) {
            clearTimeout(openTimeout);

            mfp.st.removalDelay = duration;

            if (!image) {
              image = mfp._getItemToZoom();
              if (!image) {
                return;
              }
              animatedImg = getElToAnimate(image);
            }

            animatedImg.css(mfp._getOffset(true));
            mfp.wrap.append(animatedImg);
            mfp.content.css("visibility", "hidden");

            setTimeout(function() {
              animatedImg.css(mfp._getOffset());
            }, 16);
          }
        });

        _mfpOn(CLOSE_EVENT + ns, function() {
          if (mfp._allowZoom()) {
            showMainContent();
            if (animatedImg) {
              animatedImg.remove();
            }
            image = null;
          }
        });
      },

      _allowZoom: function() {
        return mfp.currItem.type === "image";
      },

      _getItemToZoom: function() {
        if (mfp.currItem.hasSize) {
          return mfp.currItem.img;
        } else {
          return false;
        }
      },

      // Get element postion relative to viewport
      _getOffset: function(isLarge) {
        var el;
        if (isLarge) {
          el = mfp.currItem.img;
        } else {
          el = mfp.st.zoom.opener(mfp.currItem.el || mfp.currItem);
        }

        var offset = el.offset();
        var paddingTop = parseInt(el.css("padding-top"), 10);
        var paddingBottom = parseInt(el.css("padding-bottom"), 10);
        offset.top -= $(window).scrollTop() - paddingTop;

        /*

			Animating left + top + width/height looks glitchy in Firefox, but perfect in Chrome. And vice-versa.

			 */
        var obj = {
          width: el.width(),
          // fix Zepto height+padding issue
          height: (_isJQ ? el.innerHeight() : el[0].offsetHeight) - paddingBottom - paddingTop
        };

        // I hate to do this, but there is no another option
        if (getHasMozTransform()) {
          obj["-moz-transform"] = obj["transform"] =
            "translate(" + offset.left + "px," + offset.top + "px)";
        } else {
          obj.left = offset.left;
          obj.top = offset.top;
        }
        return obj;
      }
    }
  });

  /*>>zoom*/

  /*>>iframe*/

  var IFRAME_NS = "iframe",
    _emptyPage = "//about:blank",
    _fixIframeBugs = function(isShowing) {
      if (mfp.currTemplate[IFRAME_NS]) {
        var el = mfp.currTemplate[IFRAME_NS].find("iframe");
        if (el.length) {
          // reset src after the popup is closed to avoid "video keeps playing after popup is closed" bug
          if (!isShowing) {
            el[0].src = _emptyPage;
          }

          // IE8 black screen bug fix
          if (mfp.isIE8) {
            el.css("display", isShowing ? "block" : "none");
          }
        }
      }
    };

  $.magnificPopup.registerModule(IFRAME_NS, {
    options: {
      markup:
        '<div class="mfp-iframe-scaler">' +
        '<div class="mfp-close"></div>' +
        '<iframe class="mfp-iframe" src="//about:blank" frameborder="0" allowfullscreen></iframe>' +
        "</div>",

      srcAction: "iframe_src",

      // we don't care and support only one default type of URL by default
      patterns: {
        youtube: {
          index: "youtube.com",
          id: "v=",
          src: "//www.youtube.com/embed/%id%?autoplay=1"
        },
        vimeo: {
          index: "vimeo.com/",
          id: "/",
          src: "//player.vimeo.com/video/%id%?autoplay=1"
        },
        gmaps: {
          index: "//maps.google.",
          src: "%id%&output=embed"
        }
      }
    },

    proto: {
      initIframe: function() {
        mfp.types.push(IFRAME_NS);

        _mfpOn("BeforeChange", function(e, prevType, newType) {
          if (prevType !== newType) {
            if (prevType === IFRAME_NS) {
              _fixIframeBugs(); // iframe if removed
            } else if (newType === IFRAME_NS) {
              _fixIframeBugs(true); // iframe is showing
            }
          } // else {
          // iframe source is switched, don't do anything
          //}
        });

        _mfpOn(CLOSE_EVENT + "." + IFRAME_NS, function() {
          _fixIframeBugs();
        });
      },

      getIframe: function(item, template) {
        var embedSrc = item.src;
        var iframeSt = mfp.st.iframe;

        $.each(iframeSt.patterns, function() {
          if (embedSrc.indexOf(this.index) > -1) {
            if (this.id) {
              if (typeof this.id === "string") {
                embedSrc = embedSrc.substr(
                  embedSrc.lastIndexOf(this.id) + this.id.length,
                  embedSrc.length
                );
              } else {
                embedSrc = this.id.call(this, embedSrc);
              }
            }
            embedSrc = this.src.replace("%id%", embedSrc);
            return false; // break;
          }
        });

        var dataObj = {};
        if (iframeSt.srcAction) {
          dataObj[iframeSt.srcAction] = embedSrc;
        }
        mfp._parseMarkup(template, dataObj, item);

        mfp.updateStatus("ready");

        return template;
      }
    }
  });

  /*>>iframe*/

  /*>>gallery*/
  /**
   * Get looped index depending on number of slides
   */
  var _getLoopedId = function(index) {
      var numSlides = mfp.items.length;
      if (index > numSlides - 1) {
        return index - numSlides;
      } else if (index < 0) {
        return numSlides + index;
      }
      return index;
    },
    _replaceCurrTotal = function(text, curr, total) {
      return text.replace(/%curr%/gi, curr + 1).replace(/%total%/gi, total);
    };

  $.magnificPopup.registerModule("gallery", {
    options: {
      enabled: false,
      arrowMarkup:
        '<button title="%title%" type="button" class="mfp-arrow mfp-arrow-%dir%"></button>',
      preload: [0, 2],
      navigateByImgClick: true,
      arrows: true,

      tPrev: "Previous (Left arrow key)",
      tNext: "Next (Right arrow key)",
      tCounter: "%curr% of %total%"
    },

    proto: {
      initGallery: function() {
        var gSt = mfp.st.gallery,
          ns = ".mfp-gallery";

        mfp.direction = true; // true - next, false - prev

        if (!gSt || !gSt.enabled) return false;

        _wrapClasses += " mfp-gallery";

        _mfpOn(OPEN_EVENT + ns, function() {
          if (gSt.navigateByImgClick) {
            mfp.wrap.on("click" + ns, ".mfp-img", function() {
              if (mfp.items.length > 1) {
                mfp.next();
                return false;
              }
            });
          }

          _document.on("keydown" + ns, function(e) {
            if (e.keyCode === 37) {
              mfp.prev();
            } else if (e.keyCode === 39) {
              mfp.next();
            }
          });
        });

        _mfpOn("UpdateStatus" + ns, function(e, data) {
          if (data.text) {
            data.text = _replaceCurrTotal(data.text, mfp.currItem.index, mfp.items.length);
          }
        });

        _mfpOn(MARKUP_PARSE_EVENT + ns, function(e, element, values, item) {
          var l = mfp.items.length;
          values.counter = l > 1 ? _replaceCurrTotal(gSt.tCounter, item.index, l) : "";
        });

        _mfpOn("BuildControls" + ns, function() {
          if (mfp.items.length > 1 && gSt.arrows && !mfp.arrowLeft) {
            var markup = gSt.arrowMarkup,
              arrowLeft = (mfp.arrowLeft = $(
                markup.replace(/%title%/gi, gSt.tPrev).replace(/%dir%/gi, "left")
              ).addClass(PREVENT_CLOSE_CLASS)),
              arrowRight = (mfp.arrowRight = $(
                markup.replace(/%title%/gi, gSt.tNext).replace(/%dir%/gi, "right")
              ).addClass(PREVENT_CLOSE_CLASS));

            arrowLeft.click(function() {
              mfp.prev();
            });
            arrowRight.click(function() {
              mfp.next();
            });

            mfp.container.append(arrowLeft.add(arrowRight));
          }
        });

        _mfpOn(CHANGE_EVENT + ns, function() {
          if (mfp._preloadTimeout) clearTimeout(mfp._preloadTimeout);

          mfp._preloadTimeout = setTimeout(function() {
            mfp.preloadNearbyImages();
            mfp._preloadTimeout = null;
          }, 16);
        });

        _mfpOn(CLOSE_EVENT + ns, function() {
          _document.off(ns);
          mfp.wrap.off("click" + ns);
          mfp.arrowRight = mfp.arrowLeft = null;
        });
      },
      next: function() {
        mfp.direction = true;
        mfp.index = _getLoopedId(mfp.index + 1);
        mfp.updateItemHTML();
      },
      prev: function() {
        mfp.direction = false;
        mfp.index = _getLoopedId(mfp.index - 1);
        mfp.updateItemHTML();
      },
      goTo: function(newIndex) {
        mfp.direction = newIndex >= mfp.index;
        mfp.index = newIndex;
        mfp.updateItemHTML();
      },
      preloadNearbyImages: function() {
        var p = mfp.st.gallery.preload,
          preloadBefore = Math.min(p[0], mfp.items.length),
          preloadAfter = Math.min(p[1], mfp.items.length),
          i;

        for (i = 1; i <= (mfp.direction ? preloadAfter : preloadBefore); i++) {
          mfp._preloadItem(mfp.index + i);
        }
        for (i = 1; i <= (mfp.direction ? preloadBefore : preloadAfter); i++) {
          mfp._preloadItem(mfp.index - i);
        }
      },
      _preloadItem: function(index) {
        index = _getLoopedId(index);

        if (mfp.items[index].preloaded) {
          return;
        }

        var item = mfp.items[index];
        if (!item.parsed) {
          item = mfp.parseEl(index);
        }

        _mfpTrigger("LazyLoad", item);

        if (item.type === "image") {
          item.img = $('<img class="mfp-img" />')
            .on("load.mfploader", function() {
              item.hasSize = true;
            })
            .on("error.mfploader", function() {
              item.hasSize = true;
              item.loadError = true;
              _mfpTrigger("LazyLoadError", item);
            })
            .attr("src", item.src);
        }

        item.preloaded = true;
      }
    }
  });

  /*>>gallery*/

  /*>>retina*/

  var RETINA_NS = "retina";

  $.magnificPopup.registerModule(RETINA_NS, {
    options: {
      replaceSrc: function(item) {
        return item.src.replace(/\.\w+$/, function(m) {
          return "@2x" + m;
        });
      },
      ratio: 1 // Function or number.  Set to 1 to disable.
    },
    proto: {
      initRetina: function() {
        if (window.devicePixelRatio > 1) {
          var st = mfp.st.retina,
            ratio = st.ratio;

          ratio = !isNaN(ratio) ? ratio : ratio();

          if (ratio > 1) {
            _mfpOn("ImageHasSize" + "." + RETINA_NS, function(e, item) {
              item.img.css({
                "max-width": item.img[0].naturalWidth / ratio,
                width: "100%"
              });
            });
            _mfpOn("ElementParse" + "." + RETINA_NS, function(e, item) {
              item.src = st.replaceSrc(item, ratio);
            });
          }
        }
      }
    }
  });

  /*>>retina*/
  _checkInstance();
});
/*! odometer 0.4.8 */
(function() {
  var a,
    b,
    c,
    d,
    e,
    f,
    g,
    h,
    i,
    j,
    k,
    l,
    m,
    n,
    o,
    p,
    q,
    r,
    s,
    t,
    u,
    v,
    w,
    x,
    y,
    z,
    A,
    B,
    C,
    D,
    E,
    F,
    G = [].slice;
  (q = '<span class="odometer-value"></span>'),
    (n =
      '<span class="odometer-ribbon"><span class="odometer-ribbon-inner">' + q + "</span></span>"),
    (d =
      '<span class="odometer-digit"><span class="odometer-digit-spacer">8</span><span class="odometer-digit-inner">' +
      n +
      "</span></span>"),
    (g = '<span class="odometer-formatting-mark"></span>'),
    (c = "(,ddd).dd"),
    (h = /^\(?([^)]*)\)?(?:(.)(d+))?$/),
    (i = 30),
    (f = 2e3),
    (a = 20),
    (j = 2),
    (e = 0.5),
    (k = 1e3 / i),
    (b = 1e3 / a),
    (o = "transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd"),
    (y = document.createElement("div").style),
    (p =
      null != y.transition ||
      null != y.webkitTransition ||
      null != y.mozTransition ||
      null != y.oTransition),
    (w =
      window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.msRequestAnimationFrame),
    (l = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver),
    (s = function(a) {
      var b;
      return (b = document.createElement("div")), (b.innerHTML = a), b.children[0];
    }),
    (v = function(a, b) {
      return (a.className = a.className.replace(
        new RegExp("(^| )" + b.split(" ").join("|") + "( |$)", "gi"),
        " "
      ));
    }),
    (r = function(a, b) {
      return v(a, b), (a.className += " " + b);
    }),
    (z = function(a, b) {
      var c;
      return null != document.createEvent
        ? ((c = document.createEvent("HTMLEvents")), c.initEvent(b, !0, !0), a.dispatchEvent(c))
        : void 0;
    }),
    (u = function() {
      var a, b;
      return null !=
        (a = null != (b = window.performance) && "function" == typeof b.now ? b.now() : void 0)
        ? a
        : +new Date();
    }),
    (x = function(a, b) {
      return (
        null == b && (b = 0),
        b
          ? ((a *= Math.pow(10, b)), (a += 0.5), (a = Math.floor(a)), (a /= Math.pow(10, b)))
          : Math.round(a)
      );
    }),
    (A = function(a) {
      return 0 > a ? Math.ceil(a) : Math.floor(a);
    }),
    (t = function(a) {
      return a - x(a);
    }),
    (C = !1),
    (B = function() {
      var a, b, c, d, e;
      if (!C && null != window.jQuery) {
        for (C = !0, d = ["html", "text"], e = [], b = 0, c = d.length; c > b; b++)
          (a = d[b]),
            e.push(
              (function(a) {
                var b;
                return (
                  (b = window.jQuery.fn[a]),
                  (window.jQuery.fn[a] = function(a) {
                    var c;
                    return null == a || null == (null != (c = this[0]) ? c.odometer : void 0)
                      ? b.apply(this, arguments)
                      : this[0].odometer.update(a);
                  })
                );
              })(a)
            );
        return e;
      }
    })(),
    setTimeout(B, 0),
    (m = (function() {
      function a(b) {
        var c,
          d,
          e,
          g,
          h,
          i,
          l,
          m,
          n,
          o,
          p = this;
        if (((this.options = b), (this.el = this.options.el), null != this.el.odometer))
          return this.el.odometer;
        (this.el.odometer = this), (m = a.options);
        for (d in m) (g = m[d]), null == this.options[d] && (this.options[d] = g);
        null == (h = this.options).duration && (h.duration = f),
          (this.MAX_VALUES = (this.options.duration / k / j) | 0),
          this.resetFormat(),
          (this.value = this.cleanValue(null != (n = this.options.value) ? n : "")),
          this.renderInside(),
          this.render();
        try {
          for (o = ["innerHTML", "innerText", "textContent"], i = 0, l = o.length; l > i; i++)
            (e = o[i]),
              null != this.el[e] &&
                !(function(a) {
                  return Object.defineProperty(p.el, a, {
                    get: function() {
                      var b;
                      return "innerHTML" === a
                        ? p.inside.outerHTML
                        : null != (b = p.inside.innerText)
                        ? b
                        : p.inside.textContent;
                    },
                    set: function(a) {
                      return p.update(a);
                    }
                  });
                })(e);
        } catch (q) {
          (c = q), this.watchForMutations();
        }
      }
      return (
        (a.prototype.renderInside = function() {
          return (
            (this.inside = document.createElement("div")),
            (this.inside.className = "odometer-inside"),
            (this.el.innerHTML = ""),
            this.el.appendChild(this.inside)
          );
        }),
        (a.prototype.watchForMutations = function() {
          var a,
            b = this;
          if (null != l)
            try {
              return (
                null == this.observer &&
                  (this.observer = new l(function(a) {
                    var c;
                    return (c = b.el.innerText), b.renderInside(), b.render(b.value), b.update(c);
                  })),
                (this.watchMutations = !0),
                this.startWatchingMutations()
              );
            } catch (c) {
              a = c;
            }
        }),
        (a.prototype.startWatchingMutations = function() {
          return this.watchMutations ? this.observer.observe(this.el, { childList: !0 }) : void 0;
        }),
        (a.prototype.stopWatchingMutations = function() {
          var a;
          return null != (a = this.observer) ? a.disconnect() : void 0;
        }),
        (a.prototype.cleanValue = function(a) {
          var b;
          return (
            "string" == typeof a &&
              ((a = a.replace(null != (b = this.format.radix) ? b : ".", "<radix>")),
              (a = a.replace(/[.,]/g, "")),
              (a = a.replace("<radix>", ".")),
              (a = parseFloat(a, 10) || 0)),
            x(a, this.format.precision)
          );
        }),
        (a.prototype.bindTransitionEnd = function() {
          var a,
            b,
            c,
            d,
            e,
            f,
            g = this;
          if (!this.transitionEndBound) {
            for (
              this.transitionEndBound = !0, b = !1, e = o.split(" "), f = [], c = 0, d = e.length;
              d > c;
              c++
            )
              (a = e[c]),
                f.push(
                  this.el.addEventListener(
                    a,
                    function() {
                      return b
                        ? !0
                        : ((b = !0),
                          setTimeout(function() {
                            return g.render(), (b = !1), z(g.el, "odometerdone");
                          }, 0),
                          !0);
                    },
                    !1
                  )
                );
            return f;
          }
        }),
        (a.prototype.resetFormat = function() {
          var a, b, d, e, f, g, i, j;
          if (
            ((a = null != (i = this.options.format) ? i : c), a || (a = "d"), (d = h.exec(a)), !d)
          )
            throw new Error("Odometer: Unparsable digit format");
          return (
            (j = d.slice(1, 4)),
            (g = j[0]),
            (f = j[1]),
            (b = j[2]),
            (e = (null != b ? b.length : void 0) || 0),
            (this.format = { repeating: g, radix: f, precision: e })
          );
        }),
        (a.prototype.render = function(a) {
          var b, c, d, e, f, g, h;
          for (
            null == a && (a = this.value),
              this.stopWatchingMutations(),
              this.resetFormat(),
              this.inside.innerHTML = "",
              f = this.options.theme,
              b = this.el.className.split(" "),
              e = [],
              g = 0,
              h = b.length;
            h > g;
            g++
          )
            (c = b[g]),
              c.length &&
                ((d = /^odometer-theme-(.+)$/.exec(c))
                  ? (f = d[1])
                  : /^odometer(-|$)/.test(c) || e.push(c));
          return (
            e.push("odometer"),
            p || e.push("odometer-no-transitions"),
            f ? e.push("odometer-theme-" + f) : e.push("odometer-auto-theme"),
            (this.el.className = e.join(" ")),
            (this.ribbons = {}),
            this.formatDigits(a),
            this.startWatchingMutations()
          );
        }),
        (a.prototype.formatDigits = function(a) {
          var b, c, d, e, f, g, h, i, j, k;
          if (((this.digits = []), this.options.formatFunction))
            for (
              d = this.options.formatFunction(a), j = d.split("").reverse(), f = 0, h = j.length;
              h > f;
              f++
            )
              (c = j[f]),
                c.match(/0-9/)
                  ? ((b = this.renderDigit()),
                    (b.querySelector(".odometer-value").innerHTML = c),
                    this.digits.push(b),
                    this.insertDigit(b))
                  : this.addSpacer(c);
          else
            for (
              e = !this.format.precision || !t(a) || !1,
                k = a
                  .toString()
                  .split("")
                  .reverse(),
                g = 0,
                i = k.length;
              i > g;
              g++
            )
              (b = k[g]), "." === b && (e = !0), this.addDigit(b, e);
        }),
        (a.prototype.update = function(a) {
          var b,
            c = this;
          return (
            (a = this.cleanValue(a)),
            (b = a - this.value)
              ? (v(this.el, "odometer-animating-up odometer-animating-down odometer-animating"),
                b > 0 ? r(this.el, "odometer-animating-up") : r(this.el, "odometer-animating-down"),
                this.stopWatchingMutations(),
                this.animate(a),
                this.startWatchingMutations(),
                setTimeout(function() {
                  return c.el.offsetHeight, r(c.el, "odometer-animating");
                }, 0),
                (this.value = a))
              : void 0
          );
        }),
        (a.prototype.renderDigit = function() {
          return s(d);
        }),
        (a.prototype.insertDigit = function(a, b) {
          return null != b
            ? this.inside.insertBefore(a, b)
            : this.inside.children.length
            ? this.inside.insertBefore(a, this.inside.children[0])
            : this.inside.appendChild(a);
        }),
        (a.prototype.addSpacer = function(a, b, c) {
          var d;
          return (d = s(g)), (d.innerHTML = a), c && r(d, c), this.insertDigit(d, b);
        }),
        (a.prototype.addDigit = function(a, b) {
          var c, d, e, f;
          if ((null == b && (b = !0), "-" === a))
            return this.addSpacer(a, null, "odometer-negation-mark");
          if ("." === a)
            return this.addSpacer(
              null != (f = this.format.radix) ? f : ".",
              null,
              "odometer-radix-mark"
            );
          if (b)
            for (e = !1; ; ) {
              if (!this.format.repeating.length) {
                if (e) throw new Error("Bad odometer format without digits");
                this.resetFormat(), (e = !0);
              }
              if (
                ((c = this.format.repeating[this.format.repeating.length - 1]),
                (this.format.repeating = this.format.repeating.substring(
                  0,
                  this.format.repeating.length - 1
                )),
                "d" === c)
              )
                break;
              this.addSpacer(c);
            }
          return (
            (d = this.renderDigit()),
            (d.querySelector(".odometer-value").innerHTML = a),
            this.digits.push(d),
            this.insertDigit(d)
          );
        }),
        (a.prototype.animate = function(a) {
          return p && "count" !== this.options.animation
            ? this.animateSlide(a)
            : this.animateCount(a);
        }),
        (a.prototype.animateCount = function(a) {
          var c,
            d,
            e,
            f,
            g,
            h = this;
          if ((d = +a - this.value))
            return (
              (f = e = u()),
              (c = this.value),
              (g = function() {
                var i, j, k;
                return u() - f > h.options.duration
                  ? ((h.value = a), h.render(), void z(h.el, "odometerdone"))
                  : ((i = u() - e),
                    i > b &&
                      ((e = u()),
                      (k = i / h.options.duration),
                      (j = d * k),
                      (c += j),
                      h.render(Math.round(c))),
                    null != w ? w(g) : setTimeout(g, b));
              })()
            );
        }),
        (a.prototype.getDigitCount = function() {
          var a, b, c, d, e, f;
          for (
            d = 1 <= arguments.length ? G.call(arguments, 0) : [], a = e = 0, f = d.length;
            f > e;
            a = ++e
          )
            (c = d[a]), (d[a] = Math.abs(c));
          return (b = Math.max.apply(Math, d)), Math.ceil(Math.log(b + 1) / Math.log(10));
        }),
        (a.prototype.getFractionalDigitCount = function() {
          var a, b, c, d, e, f, g;
          for (
            e = 1 <= arguments.length ? G.call(arguments, 0) : [],
              b = /^\-?\d*\.(\d*?)0*$/,
              a = f = 0,
              g = e.length;
            g > f;
            a = ++f
          )
            (d = e[a]),
              (e[a] = d.toString()),
              (c = b.exec(e[a])),
              null == c ? (e[a] = 0) : (e[a] = c[1].length);
          return Math.max.apply(Math, e);
        }),
        (a.prototype.resetDigits = function() {
          return (
            (this.digits = []),
            (this.ribbons = []),
            (this.inside.innerHTML = ""),
            this.resetFormat()
          );
        }),
        (a.prototype.animateSlide = function(a) {
          var b, c, d, f, g, h, i, j, k, l, m, n, o, p, q, s, t, u, v, w, x, y, z, B, C, D, E;
          if (
            ((s = this.value),
            (j = this.getFractionalDigitCount(s, a)),
            j && ((a *= Math.pow(10, j)), (s *= Math.pow(10, j))),
            (d = a - s))
          ) {
            for (
              this.bindTransitionEnd(), f = this.getDigitCount(s, a), g = [], b = 0, m = v = 0;
              f >= 0 ? f > v : v > f;
              m = f >= 0 ? ++v : --v
            ) {
              if (
                ((t = A(s / Math.pow(10, f - m - 1))),
                (i = A(a / Math.pow(10, f - m - 1))),
                (h = i - t),
                Math.abs(h) > this.MAX_VALUES)
              ) {
                for (
                  l = [], n = h / (this.MAX_VALUES + this.MAX_VALUES * b * e), c = t;
                  (h > 0 && i > c) || (0 > h && c > i);

                )
                  l.push(Math.round(c)), (c += n);
                l[l.length - 1] !== i && l.push(i), b++;
              } else
                l = function() {
                  E = [];
                  for (var a = t; i >= t ? i >= a : a >= i; i >= t ? a++ : a--) E.push(a);
                  return E;
                }.apply(this);
              for (m = w = 0, y = l.length; y > w; m = ++w) (k = l[m]), (l[m] = Math.abs(k % 10));
              g.push(l);
            }
            for (this.resetDigits(), D = g.reverse(), m = x = 0, z = D.length; z > x; m = ++x)
              for (
                l = D[m],
                  this.digits[m] || this.addDigit(" ", m >= j),
                  null == (u = this.ribbons)[m] &&
                    (u[m] = this.digits[m].querySelector(".odometer-ribbon-inner")),
                  this.ribbons[m].innerHTML = "",
                  0 > d && (l = l.reverse()),
                  o = C = 0,
                  B = l.length;
                B > C;
                o = ++C
              )
                (k = l[o]),
                  (q = document.createElement("div")),
                  (q.className = "odometer-value"),
                  (q.innerHTML = k),
                  this.ribbons[m].appendChild(q),
                  o === l.length - 1 && r(q, "odometer-last-value"),
                  0 === o && r(q, "odometer-first-value");
            return (
              0 > t && this.addDigit("-"),
              (p = this.inside.querySelector(".odometer-radix-mark")),
              null != p && p.parent.removeChild(p),
              j
                ? this.addSpacer(this.format.radix, this.digits[j - 1], "odometer-radix-mark")
                : void 0
            );
          }
        }),
        a
      );
    })()),
    (m.options = null != (E = window.odometerOptions) ? E : {}),
    setTimeout(function() {
      var a, b, c, d, e;
      if (window.odometerOptions) {
        (d = window.odometerOptions), (e = []);
        for (a in d)
          (b = d[a]), e.push(null != (c = m.options)[a] ? (c = m.options)[a] : (c[a] = b));
        return e;
      }
    }, 0),
    (m.init = function() {
      var a, b, c, d, e, f;
      if (null != document.querySelectorAll) {
        for (
          b = document.querySelectorAll(m.options.selector || ".odometer"),
            f = [],
            c = 0,
            d = b.length;
          d > c;
          c++
        )
          (a = b[c]),
            f.push(
              (a.odometer = new m({ el: a, value: null != (e = a.innerText) ? e : a.textContent }))
            );
        return f;
      }
    }),
    null != (null != (F = document.documentElement) ? F.doScroll : void 0) &&
    null != document.createEventObject
      ? ((D = document.onreadystatechange),
        (document.onreadystatechange = function() {
          return (
            "complete" === document.readyState && m.options.auto !== !1 && m.init(),
            null != D ? D.apply(this, arguments) : void 0
          );
        }))
      : document.addEventListener(
          "DOMContentLoaded",
          function() {
            return m.options.auto !== !1 ? m.init() : void 0;
          },
          !1
        ),
    "function" == typeof define && define.amd
      ? define([], function() {
          return m;
        })
      : "undefined" != typeof exports && null !== exports
      ? (module.exports = m)
      : (window.Odometer = m);
}.call(this));

!(function(e) {
  if (!e.hasInitialised) {
    var t = {
      escapeRegExp: function(e) {
        return e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
      },
      hasClass: function(e, t) {
        var i = " ";
        return (
          1 === e.nodeType && (i + e.className + i).replace(/[\n\t]/g, i).indexOf(i + t + i) >= 0
        );
      },
      addClass: function(e, t) {
        e.className += " " + t;
      },
      removeClass: function(e, t) {
        var i = new RegExp("\\b" + this.escapeRegExp(t) + "\\b");
        e.className = e.className.replace(i, "");
      },
      interpolateString: function(e, t) {
        return e.replace(/{{([a-z][a-z0-9\-_]*)}}/gi, function(e) {
          return t(arguments[1]) || "";
        });
      },
      getCookie: function(e) {
        var t = ("; " + document.cookie).split("; " + e + "=");
        return t.length < 2
          ? void 0
          : t
              .pop()
              .split(";")
              .shift();
      },
      setCookie: function(e, t, i, n, o, s) {
        var r = new Date();
        r.setHours(r.getHours() + 24 * (i || 365));
        var a = [e + "=" + t, "expires=" + r.toUTCString(), "path=" + (o || "/")];
        n && a.push("domain=" + n), s && a.push("secure"), (document.cookie = a.join(";"));
      },
      deepExtend: function(e, t) {
        for (var i in t)
          t.hasOwnProperty(i) &&
            (i in e && this.isPlainObject(e[i]) && this.isPlainObject(t[i])
              ? this.deepExtend(e[i], t[i])
              : (e[i] = t[i]));
        return e;
      },
      throttle: function(e, t) {
        var i = !1;
        return function() {
          i ||
            (e.apply(this, arguments),
            (i = !0),
            setTimeout(function() {
              i = !1;
            }, t));
        };
      },
      hash: function(e) {
        var t,
          i,
          n = 0;
        if (0 === e.length) return n;
        for (t = 0, i = e.length; t < i; ++t) (n = (n << 5) - n + e.charCodeAt(t)), (n |= 0);
        return n;
      },
      normaliseHex: function(e) {
        return (
          "#" == e[0] && (e = e.substr(1)),
          3 == e.length && (e = e[0] + e[0] + e[1] + e[1] + e[2] + e[2]),
          e
        );
      },
      getContrast: function(e) {
        return (
          (e = this.normaliseHex(e)),
          (299 * parseInt(e.substr(0, 2), 16) +
            587 * parseInt(e.substr(2, 2), 16) +
            114 * parseInt(e.substr(4, 2), 16)) /
            1e3 >=
          128
            ? "#000"
            : "#fff"
        );
      },
      getLuminance: function(e) {
        var t = parseInt(this.normaliseHex(e), 16),
          i = 38 + (t >> 16),
          n = 38 + ((t >> 8) & 255),
          o = 38 + (255 & t);
        return (
          "#" +
          (
            16777216 +
            65536 * (i < 255 ? (i < 1 ? 0 : i) : 255) +
            256 * (n < 255 ? (n < 1 ? 0 : n) : 255) +
            (o < 255 ? (o < 1 ? 0 : o) : 255)
          )
            .toString(16)
            .slice(1)
        );
      },
      isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      },
      isPlainObject: function(e) {
        return "object" == typeof e && null !== e && e.constructor == Object;
      },
      traverseDOMPath: function(e, i) {
        return e && e.parentNode
          ? t.hasClass(e, i)
            ? e
            : this.traverseDOMPath(e.parentNode, i)
          : null;
      }
    };
    (e.status = { deny: "deny", allow: "allow", dismiss: "dismiss" }),
      (e.transitionEnd = (function() {
        var e = document.createElement("div"),
          t = {
            t: "transitionend",
            OT: "oTransitionEnd",
            msT: "MSTransitionEnd",
            MozT: "transitionend",
            WebkitT: "webkitTransitionEnd"
          };
        for (var i in t)
          if (t.hasOwnProperty(i) && void 0 !== e.style[i + "ransition"]) return t[i];
        return "";
      })()),
      (e.hasTransition = !!e.transitionEnd);
    var i = Object.keys(e.status).map(t.escapeRegExp);
    (e.customStyles = {}),
      (e.Popup = (function() {
        var n = {
          enabled: !0,
          container: null,
          cookie: {
            name: "cookieconsent_status",
            path: "/",
            domain: "",
            expiryDays: 365,
            secure: !1
          },
          onPopupOpen: function() {},
          onPopupClose: function() {},
          onInitialise: function(e) {},
          onStatusChange: function(e, t) {},
          onRevokeChoice: function() {},
          onNoCookieLaw: function(e, t) {},
          content: {
            header: "Cookies used on the website!",
            message:
              "This website uses cookies to ensure you get the best experience on our website.",
            dismiss: "Got it!",
            allow: "Allow cookies",
            deny: "Decline",
            link: "Learn more",
            href: "https://www.cookiesandyou.com",
            close: "&#x274c;",
            target: "_blank",
            policy: "Cookie Policy"
          },
          elements: {
            header: '<span class="cc-header">{{header}}</span>&nbsp;',
            message: '<span id="cookieconsent:desc" class="cc-message">{{message}}</span>',
            messagelink:
              '<span id="cookieconsent:desc" class="cc-message">{{message}} <a aria-label="learn more about cookies" role=button tabindex="0" class="cc-link" href="{{href}}" rel="noopener noreferrer nofollow" target="{{target}}">{{link}}</a></span>',
            dismiss:
              '<a aria-label="dismiss cookie message" role=button tabindex="0" class="cc-btn cc-dismiss">{{dismiss}}</a>',
            allow:
              '<a aria-label="allow cookies" role=button tabindex="0"  class="cc-btn cc-allow">{{allow}}</a>',
            deny:
              '<a aria-label="deny cookies" role=button tabindex="0" class="cc-btn cc-deny">{{deny}}</a>',
            link:
              '<a aria-label="learn more about cookies" role=button tabindex="0" class="cc-link" href="{{href}}" rel="noopener noreferrer nofollow" target="{{target}}">{{link}}</a>',
            close:
              '<span aria-label="dismiss cookie message" role=button tabindex="0" class="cc-close">{{close}}</span>'
          },
          window:
            '<div role="dialog" aria-live="polite" aria-label="cookieconsent" aria-describedby="cookieconsent:desc" class="cc-window {{classes}}">\x3c!--googleoff: all--\x3e{{children}}\x3c!--googleon: all--\x3e</div>',
          revokeBtn: '<div class="cc-revoke {{classes}}">{{policy}}</div>',
          compliance: {
            info: '<div class="cc-compliance">{{dismiss}}</div>',
            "opt-in": '<div class="cc-compliance cc-highlight">{{deny}}{{allow}}</div>',
            "opt-out": '<div class="cc-compliance cc-highlight">{{deny}}{{allow}}</div>'
          },
          type: "info",
          layouts: {
            basic: "{{messagelink}}{{compliance}}",
            "basic-close": "{{messagelink}}{{compliance}}{{close}}",
            "basic-header": "{{header}}{{message}}{{link}}{{compliance}}"
          },
          layout: "basic",
          position: "bottom",
          theme: "block",
          static: !1,
          palette: null,
          revokable: !1,
          animateRevokable: !0,
          showLink: !0,
          dismissOnScroll: !1,
          dismissOnTimeout: !1,
          dismissOnWindowClick: !1,
          ignoreClicksFrom: ["cc-revoke", "cc-btn"],
          autoOpen: !0,
          autoAttach: !0,
          whitelistPage: [],
          blacklistPage: [],
          overrideHTML: null
        };
        function o() {
          this.initialise.apply(this, arguments);
        }
        function s(e) {
          (this.openingTimeout = null), t.removeClass(e, "cc-invisible");
        }
        function r(t) {
          (t.style.display = "none"),
            t.removeEventListener(e.transitionEnd, this.afterTransition),
            (this.afterTransition = null);
        }
        function a() {
          var e = this.options.position.split("-"),
            t = [];
          return (
            e.forEach(function(e) {
              t.push("cc-" + e);
            }),
            t
          );
        }
        function c(n) {
          var o = this.options,
            s = document.createElement("div"),
            r = o.container && 1 === o.container.nodeType ? o.container : document.body;
          s.innerHTML = n;
          var a = s.children[0];
          return (
            (a.style.display = "none"),
            t.hasClass(a, "cc-window") && e.hasTransition && t.addClass(a, "cc-invisible"),
            (this.onButtonClick = function(n) {
              var o = t.traverseDOMPath(n.target, "cc-btn") || n.target;
              if (t.hasClass(o, "cc-btn")) {
                var s = o.className.match(new RegExp("\\bcc-(" + i.join("|") + ")\\b")),
                  r = (s && s[1]) || !1;
                r && (this.setStatus(r), this.close(!0));
              }
              t.hasClass(o, "cc-close") && (this.setStatus(e.status.dismiss), this.close(!0));
              t.hasClass(o, "cc-revoke") && this.revokeChoice();
            }.bind(this)),
            a.addEventListener("click", this.onButtonClick),
            o.autoAttach && (r.firstChild ? r.insertBefore(a, r.firstChild) : r.appendChild(a)),
            a
          );
        }
        function l(e) {
          return "000000" == (e = t.normaliseHex(e)) ? "#222" : t.getLuminance(e);
        }
        function u(e, t) {
          for (var i = 0, n = e.length; i < n; ++i) {
            var o = e[i];
            if ((o instanceof RegExp && o.test(t)) || ("string" == typeof o && o.length && o === t))
              return !0;
          }
          return !1;
        }
        return (
          (o.prototype.initialise = function(i) {
            this.options && this.destroy(),
              t.deepExtend((this.options = {}), n),
              t.isPlainObject(i) && t.deepExtend(this.options, i),
              function() {
                var t = this.options.onInitialise.bind(this);
                if (!window.navigator.cookieEnabled) return t(e.status.deny), !0;
                if (window.CookiesOK || window.navigator.CookiesOK) return t(e.status.allow), !0;
                var i = Object.keys(e.status),
                  n = this.getStatus(),
                  o = i.indexOf(n) >= 0;
                o && t(n);
                return o;
              }.call(this) && (this.options.enabled = !1),
              u(this.options.blacklistPage, location.pathname) && (this.options.enabled = !1),
              u(this.options.whitelistPage, location.pathname) && (this.options.enabled = !0);
            var o = this.options.window
                .replace(
                  "{{classes}}",
                  function() {
                    var i = this.options,
                      n = "top" == i.position || "bottom" == i.position ? "banner" : "floating";
                    t.isMobile() && (n = "floating");
                    var o = ["cc-" + n, "cc-type-" + i.type, "cc-theme-" + i.theme];
                    i.static && o.push("cc-static");
                    o.push.apply(o, a.call(this));
                    (function(i) {
                      var n = t.hash(JSON.stringify(i)),
                        o = "cc-color-override-" + n,
                        s = t.isPlainObject(i);
                      (this.customStyleSelector = s ? o : null),
                        s &&
                          (function(i, n, o) {
                            if (e.customStyles[i]) return void ++e.customStyles[i].references;
                            var s = {},
                              r = n.popup,
                              a = n.button,
                              c = n.highlight;
                            r &&
                              ((r.text = r.text ? r.text : t.getContrast(r.background)),
                              (r.link = r.link ? r.link : r.text),
                              (s[o + ".cc-window"] = [
                                "color: " + r.text,
                                "background-color: " + r.background
                              ]),
                              (s[o + ".cc-revoke"] = [
                                "color: " + r.text,
                                "background-color: " + r.background
                              ]),
                              (s[
                                o + " .cc-link," + o + " .cc-link:active," + o + " .cc-link:visited"
                              ] = ["color: " + r.link]),
                              a &&
                                ((a.text = a.text ? a.text : t.getContrast(a.background)),
                                (a.border = a.border ? a.border : "transparent"),
                                (s[o + " .cc-btn"] = [
                                  "color: " + a.text,
                                  "border-color: " + a.border,
                                  "background-color: " + a.background
                                ]),
                                a.padding && s[o + " .cc-btn"].push("padding: " + a.padding),
                                "transparent" != a.background &&
                                  (s[o + " .cc-btn:hover, " + o + " .cc-btn:focus"] = [
                                    "background-color: " + (a.hover || l(a.background))
                                  ]),
                                c
                                  ? ((c.text = c.text ? c.text : t.getContrast(c.background)),
                                    (c.border = c.border ? c.border : "transparent"),
                                    (s[o + " .cc-highlight .cc-btn:first-child"] = [
                                      "color: " + c.text,
                                      "border-color: " + c.border,
                                      "background-color: " + c.background
                                    ]))
                                  : (s[o + " .cc-highlight .cc-btn:first-child"] = [
                                      "color: " + r.text
                                    ])));
                            var u = document.createElement("style");
                            document.head.appendChild(u),
                              (e.customStyles[i] = { references: 1, element: u.sheet });
                            var h = -1;
                            for (var p in s)
                              s.hasOwnProperty(p) &&
                                u.sheet.insertRule(p + "{" + s[p].join(";") + "}", ++h);
                          })(n, i, "." + o);
                      return s;
                    }.call(this, this.options.palette));
                    this.customStyleSelector && o.push(this.customStyleSelector);
                    return o;
                  }
                    .call(this)
                    .join(" ")
                )
                .replace(
                  "{{children}}",
                  function() {
                    var e = {},
                      i = this.options;
                    i.showLink ||
                      ((i.elements.link = ""), (i.elements.messagelink = i.elements.message));
                    Object.keys(i.elements).forEach(function(n) {
                      e[n] = t.interpolateString(i.elements[n], function(e) {
                        var t = i.content[e];
                        return e && "string" == typeof t && t.length ? t : "";
                      });
                    });
                    var n = i.compliance[i.type];
                    n || (n = i.compliance.info);
                    e.compliance = t.interpolateString(n, function(t) {
                      return e[t];
                    });
                    var o = i.layouts[i.layout];
                    o || (o = i.layouts.basic);
                    return t.interpolateString(o, function(t) {
                      return e[t];
                    });
                  }.call(this)
                ),
              s = this.options.overrideHTML;
            if (("string" == typeof s && s.length && (o = s), this.options.static)) {
              var r = c.call(this, '<div class="cc-grower">' + o + "</div>");
              (r.style.display = ""),
                (this.element = r.firstChild),
                (this.element.style.display = "none"),
                t.addClass(this.element, "cc-invisible");
            } else this.element = c.call(this, o);
            (function() {
              var i = this.setStatus.bind(this),
                n = this.close.bind(this),
                o = this.options.dismissOnTimeout;
              "number" == typeof o &&
                o >= 0 &&
                (this.dismissTimeout = window.setTimeout(function() {
                  i(e.status.dismiss), n(!0);
                }, Math.floor(o)));
              var s = this.options.dismissOnScroll;
              if ("number" == typeof s && s >= 0) {
                var r = function(t) {
                  window.pageYOffset > Math.floor(s) &&
                    (i(e.status.dismiss),
                    n(!0),
                    window.removeEventListener("scroll", r),
                    (this.onWindowScroll = null));
                };
                this.options.enabled &&
                  ((this.onWindowScroll = r), window.addEventListener("scroll", r));
              }
              var a = this.options.dismissOnWindowClick,
                c = this.options.ignoreClicksFrom;
              if (a) {
                var l = function(o) {
                  for (var s = !1, r = o.path.length, a = c.length, u = 0; u < r; u++)
                    if (!s) for (var h = 0; h < a; h++) s || (s = t.hasClass(o.path[u], c[h]));
                  s ||
                    (i(e.status.dismiss),
                    n(!0),
                    window.removeEventListener("click", l),
                    window.removeEventListener("touchend", l),
                    (this.onWindowClick = null));
                }.bind(this);
                this.options.enabled &&
                  ((this.onWindowClick = l),
                  window.addEventListener("click", l),
                  window.addEventListener("touchend", l));
              }
            }.call(this),
              function() {
                "info" != this.options.type && (this.options.revokable = !0);
                t.isMobile() && (this.options.animateRevokable = !1);
                if (this.options.revokable) {
                  var e = a.call(this);
                  this.options.animateRevokable && e.push("cc-animate"),
                    this.customStyleSelector && e.push(this.customStyleSelector);
                  var i = this.options.revokeBtn
                    .replace("{{classes}}", e.join(" "))
                    .replace("{{policy}}", this.options.content.policy);
                  this.revokeBtn = c.call(this, i);
                  var n = this.revokeBtn;
                  if (this.options.animateRevokable) {
                    var o = t.throttle(function(e) {
                      var i = !1,
                        o = window.innerHeight - 20;
                      t.hasClass(n, "cc-top") && e.clientY < 20 && (i = !0),
                        t.hasClass(n, "cc-bottom") && e.clientY > o && (i = !0),
                        i
                          ? t.hasClass(n, "cc-active") || t.addClass(n, "cc-active")
                          : t.hasClass(n, "cc-active") && t.removeClass(n, "cc-active");
                    }, 200);
                    (this.onMouseMove = o), window.addEventListener("mousemove", o);
                  }
                }
              }.call(this),
              this.options.autoOpen && this.autoOpen());
          }),
          (o.prototype.destroy = function() {
            this.onButtonClick &&
              this.element &&
              (this.element.removeEventListener("click", this.onButtonClick),
              (this.onButtonClick = null)),
              this.dismissTimeout &&
                (clearTimeout(this.dismissTimeout), (this.dismissTimeout = null)),
              this.onWindowScroll &&
                (window.removeEventListener("scroll", this.onWindowScroll),
                (this.onWindowScroll = null)),
              this.onWindowClick &&
                (window.removeEventListener("click", this.onWindowClick),
                (this.onWindowClick = null)),
              this.onMouseMove &&
                (window.removeEventListener("mousemove", this.onMouseMove),
                (this.onMouseMove = null)),
              this.element &&
                this.element.parentNode &&
                this.element.parentNode.removeChild(this.element),
              (this.element = null),
              this.revokeBtn &&
                this.revokeBtn.parentNode &&
                this.revokeBtn.parentNode.removeChild(this.revokeBtn),
              (this.revokeBtn = null),
              (function(i) {
                if (t.isPlainObject(i)) {
                  var n = t.hash(JSON.stringify(i)),
                    o = e.customStyles[n];
                  if (o && !--o.references) {
                    var s = o.element.ownerNode;
                    s && s.parentNode && s.parentNode.removeChild(s), (e.customStyles[n] = null);
                  }
                }
              })(this.options.palette),
              (this.options = null);
          }),
          (o.prototype.open = function(t) {
            if (this.element)
              return (
                this.isOpen() ||
                  (e.hasTransition ? this.fadeIn() : (this.element.style.display = ""),
                  this.options.revokable && this.toggleRevokeButton(),
                  this.options.onPopupOpen.call(this)),
                this
              );
          }),
          (o.prototype.close = function(t) {
            if (this.element)
              return (
                this.isOpen() &&
                  (e.hasTransition ? this.fadeOut() : (this.element.style.display = "none"),
                  t && this.options.revokable && this.toggleRevokeButton(!0),
                  this.options.onPopupClose.call(this)),
                this
              );
          }),
          (o.prototype.fadeIn = function() {
            var i = this.element;
            if (
              e.hasTransition &&
              i &&
              (this.afterTransition && r.call(this, i), t.hasClass(i, "cc-invisible"))
            ) {
              if (((i.style.display = ""), this.options.static)) {
                var n = this.element.clientHeight;
                this.element.parentNode.style.maxHeight = n + "px";
              }
              this.openingTimeout = setTimeout(s.bind(this, i), 20);
            }
          }),
          (o.prototype.fadeOut = function() {
            var i = this.element;
            e.hasTransition &&
              i &&
              (this.openingTimeout && (clearTimeout(this.openingTimeout), s.bind(this, i)),
              t.hasClass(i, "cc-invisible") ||
                (this.options.static && (this.element.parentNode.style.maxHeight = ""),
                (this.afterTransition = r.bind(this, i)),
                i.addEventListener(e.transitionEnd, this.afterTransition),
                t.addClass(i, "cc-invisible")));
          }),
          (o.prototype.isOpen = function() {
            return (
              this.element &&
              "" == this.element.style.display &&
              (!e.hasTransition || !t.hasClass(this.element, "cc-invisible"))
            );
          }),
          (o.prototype.toggleRevokeButton = function(e) {
            this.revokeBtn && (this.revokeBtn.style.display = e ? "" : "none");
          }),
          (o.prototype.revokeChoice = function(e) {
            (this.options.enabled = !0),
              this.clearStatus(),
              this.options.onRevokeChoice.call(this),
              e || this.autoOpen();
          }),
          (o.prototype.hasAnswered = function(t) {
            return Object.keys(e.status).indexOf(this.getStatus()) >= 0;
          }),
          (o.prototype.hasConsented = function(t) {
            var i = this.getStatus();
            return i == e.status.allow || i == e.status.dismiss;
          }),
          (o.prototype.autoOpen = function(e) {
            !this.hasAnswered() && this.options.enabled
              ? this.open()
              : this.hasAnswered() && this.options.revokable && this.toggleRevokeButton(!0);
          }),
          (o.prototype.setStatus = function(i) {
            var n = this.options.cookie,
              o = t.getCookie(n.name),
              s = Object.keys(e.status).indexOf(o) >= 0;
            Object.keys(e.status).indexOf(i) >= 0
              ? (t.setCookie(n.name, i, n.expiryDays, n.domain, n.path, n.secure),
                this.options.onStatusChange.call(this, i, s))
              : this.clearStatus();
          }),
          (o.prototype.getStatus = function() {
            return t.getCookie(this.options.cookie.name);
          }),
          (o.prototype.clearStatus = function() {
            var e = this.options.cookie;
            t.setCookie(e.name, "", -1, e.domain, e.path);
          }),
          o
        );
      })()),
      (e.Location = (function() {
        var e = {
          timeout: 5e3,
          services: ["ipinfo"],
          serviceDefinitions: {
            ipinfo: function() {
              return {
                url: "//ipinfo.io",
                headers: ["Accept: application/json"],
                callback: function(e, t) {
                  try {
                    var i = JSON.parse(t);
                    return i.error ? s(i) : { code: i.country };
                  } catch (e) {
                    return s({ error: "Invalid response (" + e + ")" });
                  }
                }
              };
            },
            ipinfodb: function(e) {
              return {
                url:
                  "//api.ipinfodb.com/v3/ip-country/?key={api_key}&format=json&callback={callback}",
                isScript: !0,
                callback: function(e, t) {
                  try {
                    var i = JSON.parse(t);
                    return "ERROR" == i.statusCode
                      ? s({ error: i.statusMessage })
                      : { code: i.countryCode };
                  } catch (e) {
                    return s({ error: "Invalid response (" + e + ")" });
                  }
                }
              };
            },
            maxmind: function() {
              return {
                url: "//js.maxmind.com/js/apis/geoip2/v2.1/geoip2.js",
                isScript: !0,
                callback: function(e) {
                  window.geoip2
                    ? geoip2.country(
                        function(t) {
                          try {
                            e({ code: t.country.iso_code });
                          } catch (t) {
                            e(s(t));
                          }
                        },
                        function(t) {
                          e(s(t));
                        }
                      )
                    : e(
                        new Error(
                          "Unexpected response format. The downloaded script should have exported `geoip2` to the global scope"
                        )
                      );
                }
              };
            }
          }
        };
        function i(i) {
          t.deepExtend((this.options = {}), e),
            t.isPlainObject(i) && t.deepExtend(this.options, i),
            (this.currentServiceIndex = -1);
        }
        function n(e, t, i) {
          var n,
            o = document.createElement("script");
          (o.type = "text/" + (e.type || "javascript")),
            (o.src = e.src || e),
            (o.async = !1),
            (o.onreadystatechange = o.onload = function() {
              var e = o.readyState;
              clearTimeout(n),
                t.done ||
                  (e && !/loaded|complete/.test(e)) ||
                  ((t.done = !0), t(), (o.onreadystatechange = o.onload = null));
            }),
            document.body.appendChild(o),
            (n = setTimeout(function() {
              (t.done = !0), t(), (o.onreadystatechange = o.onload = null);
            }, i));
        }
        function o(e, t, i, n, o) {
          var s = new (window.XMLHttpRequest || window.ActiveXObject)("MSXML2.XMLHTTP.3.0");
          if (
            (s.open(n ? "POST" : "GET", e, 1),
            s.setRequestHeader("Content-type", "application/x-www-form-urlencoded"),
            Array.isArray(o))
          )
            for (var r = 0, a = o.length; r < a; ++r) {
              var c = o[r].split(":", 2);
              s.setRequestHeader(c[0].replace(/^\s+|\s+$/g, ""), c[1].replace(/^\s+|\s+$/g, ""));
            }
          "function" == typeof t &&
            (s.onreadystatechange = function() {
              s.readyState > 3 && t(s);
            }),
            s.send(n);
        }
        function s(e) {
          return new Error("Error [" + (e.code || "UNKNOWN") + "]: " + e.error);
        }
        return (
          (i.prototype.getNextService = function() {
            var e;
            do {
              e = this.getServiceByIdx(++this.currentServiceIndex);
            } while (this.currentServiceIndex < this.options.services.length && !e);
            return e;
          }),
          (i.prototype.getServiceByIdx = function(e) {
            var i = this.options.services[e];
            if ("function" == typeof i) {
              var n = i();
              return n.name && t.deepExtend(n, this.options.serviceDefinitions[n.name](n)), n;
            }
            return "string" == typeof i
              ? this.options.serviceDefinitions[i]()
              : t.isPlainObject(i)
              ? this.options.serviceDefinitions[i.name](i)
              : null;
          }),
          (i.prototype.locate = function(e, t) {
            var i = this.getNextService();
            i
              ? ((this.callbackComplete = e),
                (this.callbackError = t),
                this.runService(i, this.runNextServiceOnError.bind(this)))
              : t(new Error("No services to run"));
          }),
          (i.prototype.setupUrl = function(e) {
            var t = this.getCurrentServiceOpts();
            return e.url.replace(/\{(.*?)\}/g, function(i, n) {
              if ("callback" === n) {
                var o = "callback" + Date.now();
                return (
                  (window[o] = function(t) {
                    e.__JSONP_DATA = JSON.stringify(t);
                  }),
                  o
                );
              }
              if (n in t.interpolateUrl) return t.interpolateUrl[n];
            });
          }),
          (i.prototype.runService = function(e, t) {
            var i = this;
            e &&
              e.url &&
              e.callback &&
              (e.isScript ? n : o)(
                this.setupUrl(e),
                function(n) {
                  var o = n ? n.responseText : "";
                  e.__JSONP_DATA && ((o = e.__JSONP_DATA), delete e.__JSONP_DATA),
                    i.runServiceCallback.call(i, t, e, o);
                },
                this.options.timeout,
                e.data,
                e.headers
              );
          }),
          (i.prototype.runServiceCallback = function(e, t, i) {
            var n = this,
              o = t.callback(function(t) {
                o || n.onServiceResult.call(n, e, t);
              }, i);
            o && this.onServiceResult.call(this, e, o);
          }),
          (i.prototype.onServiceResult = function(e, t) {
            t instanceof Error || (t && t.error) ? e.call(this, t, null) : e.call(this, null, t);
          }),
          (i.prototype.runNextServiceOnError = function(e, t) {
            if (e) {
              this.logError(e);
              var i = this.getNextService();
              i
                ? this.runService(i, this.runNextServiceOnError.bind(this))
                : this.completeService.call(
                    this,
                    this.callbackError,
                    new Error("All services failed")
                  );
            } else this.completeService.call(this, this.callbackComplete, t);
          }),
          (i.prototype.getCurrentServiceOpts = function() {
            var e = this.options.services[this.currentServiceIndex];
            return "string" == typeof e
              ? { name: e }
              : "function" == typeof e
              ? e()
              : t.isPlainObject(e)
              ? e
              : {};
          }),
          (i.prototype.completeService = function(e, t) {
            (this.currentServiceIndex = -1), e && e(t);
          }),
          (i.prototype.logError = function(e) {
            var t = this.currentServiceIndex,
              i = this.getServiceByIdx(t);
            console.warn(
              "The service[" + t + "] (" + i.url + ") responded with the following error",
              e
            );
          }),
          i
        );
      })()),
      (e.Law = (function() {
        var e = {
          regionalLaw: !0,
          hasLaw: [
            "AT",
            "BE",
            "BG",
            "HR",
            "CZ",
            "CY",
            "DK",
            "EE",
            "FI",
            "FR",
            "DE",
            "EL",
            "HU",
            "IE",
            "IT",
            "LV",
            "LT",
            "LU",
            "MT",
            "NL",
            "PL",
            "PT",
            "SK",
            "ES",
            "SE",
            "GB",
            "UK",
            "GR",
            "EU"
          ],
          revokable: ["HR", "CY", "DK", "EE", "FR", "DE", "LV", "LT", "NL", "PT", "ES"],
          explicitAction: ["HR", "IT", "ES"]
        };
        function i(e) {
          this.initialise.apply(this, arguments);
        }
        return (
          (i.prototype.initialise = function(i) {
            t.deepExtend((this.options = {}), e),
              t.isPlainObject(i) && t.deepExtend(this.options, i);
          }),
          (i.prototype.get = function(e) {
            var t = this.options;
            return {
              hasLaw: t.hasLaw.indexOf(e) >= 0,
              revokable: t.revokable.indexOf(e) >= 0,
              explicitAction: t.explicitAction.indexOf(e) >= 0
            };
          }),
          (i.prototype.applyLaw = function(e, t) {
            var i = this.get(t);
            return (
              i.hasLaw ||
                ((e.enabled = !1), "function" == typeof e.onNoCookieLaw && e.onNoCookieLaw(t, i)),
              this.options.regionalLaw &&
                (i.revokable && (e.revokable = !0),
                i.explicitAction && ((e.dismissOnScroll = !1), (e.dismissOnTimeout = !1))),
              e
            );
          }),
          i
        );
      })()),
      (e.initialise = function(i, n, o) {
        var s = new e.Law(i.law);
        n || (n = function() {}), o || (o = function() {});
        var r = Object.keys(e.status),
          a = t.getCookie("cookieconsent_status");
        r.indexOf(a) >= 0
          ? n(new e.Popup(i))
          : e.getCountryCode(
              i,
              function(t) {
                delete i.law,
                  delete i.location,
                  t.code && (i = s.applyLaw(i, t.code)),
                  n(new e.Popup(i));
              },
              function(t) {
                delete i.law, delete i.location, o(t, new e.Popup(i));
              }
            );
      }),
      (e.getCountryCode = function(t, i, n) {
        t.law && t.law.countryCode
          ? i({ code: t.law.countryCode })
          : t.location
          ? new e.Location(t.location).locate(function(e) {
              i(e || {});
            }, n)
          : i({});
      }),
      (e.utils = t),
      (e.hasInitialised = !0),
      (window.cookieconsent = e);
  }
})(window.cookieconsent || {});
!(function(t, e) {
  "object" == typeof exports && "object" == typeof module
    ? (module.exports = e())
    : "function" == typeof define && define.amd
    ? define([], e)
    : "object" == typeof exports
    ? (exports.counterUp = e())
    : (t.counterUp = e());
})(window, function() {
  return (function(t) {
    var e = {};
    function n(r) {
      if (e[r]) return e[r].exports;
      var o = (e[r] = { i: r, l: !1, exports: {} });
      return t[r].call(o.exports, o, o.exports, n), (o.l = !0), o.exports;
    }
    return (
      (n.m = t),
      (n.c = e),
      (n.d = function(t, e, r) {
        n.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: r });
      }),
      (n.r = function(t) {
        "undefined" != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
          Object.defineProperty(t, "__esModule", { value: !0 });
      }),
      (n.t = function(t, e) {
        if ((1 & e && (t = n(t)), 8 & e)) return t;
        if (4 & e && "object" == typeof t && t && t.__esModule) return t;
        var r = Object.create(null);
        if (
          (n.r(r),
          Object.defineProperty(r, "default", { enumerable: !0, value: t }),
          2 & e && "string" != typeof t)
        )
          for (var o in t)
            n.d(
              r,
              o,
              function(e) {
                return t[e];
              }.bind(null, o)
            );
        return r;
      }),
      (n.n = function(t) {
        var e =
          t && t.__esModule
            ? function() {
                return t.default;
              }
            : function() {
                return t;
              };
        return n.d(e, "a", e), e;
      }),
      (n.o = function(t, e) {
        return Object.prototype.hasOwnProperty.call(t, e);
      }),
      (n.p = ""),
      n((n.s = 0))
    );
  })([
    function(t, e, n) {
      "use strict";
      n.r(e),
        n.d(e, "divideNumbers", function() {
          return o;
        }),
        n.d(e, "hasComma", function() {
          return i;
        }),
        n.d(e, "isFloat", function() {
          return u;
        }),
        n.d(e, "decimalPlaces", function() {
          return l;
        });
      e.default = function(t) {
        var e = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          n = e.action,
          i = void 0 === n ? "start" : n,
          u = e.duration,
          l = void 0 === u ? 1e3 : u,
          a = e.delay,
          c = void 0 === a ? 16 : a,
          d = e.lang,
          f = void 0 === d ? void 0 : d;
        if ("stop" !== i) {
          if ((r(t), /[0-9]/.test(t.innerHTML))) {
            var s = o(t.innerHTML, {
              duration: l || t.getAttribute("data-duration"),
              lang: f || document.querySelector("html").getAttribute("lang") || void 0,
              delay: c || t.getAttribute("data-delay")
            });
            (t._countUpOrigInnerHTML = t.innerHTML),
              (t.innerHTML = s[0]),
              (t.style.visibility = "visible"),
              (t.countUpTimeout = setTimeout(function e() {
                (t.innerHTML = s.shift()),
                  s.length
                    ? (clearTimeout(t.countUpTimeout), (t.countUpTimeout = setTimeout(e, c)))
                    : (t._countUpOrigInnerHTML = void 0);
              }, c));
          }
        } else r(t);
      };
      var r = function(t) {
          clearTimeout(t.countUpTimeout),
            t._countUpOrigInnerHTML &&
              ((t.innerHTML = t._countUpOrigInnerHTML), (t._countUpOrigInnerHTML = void 0)),
            (t.style.visibility = "");
        },
        o = function(t) {
          for (
            var e = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
              n = e.duration,
              r = void 0 === n ? 1e3 : n,
              o = e.delay,
              i = void 0 === o ? 16 : o,
              u = e.lang,
              l = void 0 === u ? void 0 : u,
              a = r / i,
              c = t.toString().split(/(<[^>]+>|[0-9.][,.0-9]*[0-9]*)/),
              d = [],
              f = 0;
            f < a;
            f++
          )
            d.push("");
          for (var s = 0; s < c.length; s++)
            if (/([0-9.][,.0-9]*[0-9]*)/.test(c[s]) && !/<[^>]+>/.test(c[s])) {
              var p = c[s],
                v = /[0-9]+,[0-9]+/.test(p);
              p = p.replace(/,/g, "");
              for (
                var g = /^[0-9]+\.[0-9]+$/.test(p),
                  y = g ? (p.split(".")[1] || []).length : 0,
                  b = d.length - 1,
                  m = a;
                m >= 1;
                m--
              ) {
                var T = parseInt((p / a) * m, 10);
                g &&
                  ((T = parseFloat((p / a) * m).toFixed(y)), (T = parseFloat(T).toLocaleString(l))),
                  v && (T = T.toLocaleString(l)),
                  (d[b--] += T);
              }
            } else for (var M = 0; M < a; M++) d[M] += c[s];
          return (d[d.length] = t.toString()), d;
        },
        i = function(t) {
          return /[0-9]+,[0-9]+/.test(t);
        },
        u = function(t) {
          return /^[0-9]+\.[0-9]+$/.test(t);
        },
        l = function(t) {
          return u(t) ? (t.split(".")[1] || []).length : 0;
        };
    }
  ]);
});
/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global) {
  // Passing in seed will seed this Noise instance
  function Noise(seed) {
    function Grad(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    Grad.prototype.dot2 = function(x, y) {
      return this.x * x + this.y * y;
    };

    Grad.prototype.dot3 = function(x, y, z) {
      return this.x * x + this.y * y + this.z * z;
    };

    this.grad3 = [
      new Grad(1, 1, 0),
      new Grad(-1, 1, 0),
      new Grad(1, -1, 0),
      new Grad(-1, -1, 0),
      new Grad(1, 0, 1),
      new Grad(-1, 0, 1),
      new Grad(1, 0, -1),
      new Grad(-1, 0, -1),
      new Grad(0, 1, 1),
      new Grad(0, -1, 1),
      new Grad(0, 1, -1),
      new Grad(0, -1, -1)
    ];

    this.p = [
      151,
      160,
      137,
      91,
      90,
      15,
      131,
      13,
      201,
      95,
      96,
      53,
      194,
      233,
      7,
      225,
      140,
      36,
      103,
      30,
      69,
      142,
      8,
      99,
      37,
      240,
      21,
      10,
      23,
      190,
      6,
      148,
      247,
      120,
      234,
      75,
      0,
      26,
      197,
      62,
      94,
      252,
      219,
      203,
      117,
      35,
      11,
      32,
      57,
      177,
      33,
      88,
      237,
      149,
      56,
      87,
      174,
      20,
      125,
      136,
      171,
      168,
      68,
      175,
      74,
      165,
      71,
      134,
      139,
      48,
      27,
      166,
      77,
      146,
      158,
      231,
      83,
      111,
      229,
      122,
      60,
      211,
      133,
      230,
      220,
      105,
      92,
      41,
      55,
      46,
      245,
      40,
      244,
      102,
      143,
      54,
      65,
      25,
      63,
      161,
      1,
      216,
      80,
      73,
      209,
      76,
      132,
      187,
      208,
      89,
      18,
      169,
      200,
      196,
      135,
      130,
      116,
      188,
      159,
      86,
      164,
      100,
      109,
      198,
      173,
      186,
      3,
      64,
      52,
      217,
      226,
      250,
      124,
      123,
      5,
      202,
      38,
      147,
      118,
      126,
      255,
      82,
      85,
      212,
      207,
      206,
      59,
      227,
      47,
      16,
      58,
      17,
      182,
      189,
      28,
      42,
      223,
      183,
      170,
      213,
      119,
      248,
      152,
      2,
      44,
      154,
      163,
      70,
      221,
      153,
      101,
      155,
      167,
      43,
      172,
      9,
      129,
      22,
      39,
      253,
      19,
      98,
      108,
      110,
      79,
      113,
      224,
      232,
      178,
      185,
      112,
      104,
      218,
      246,
      97,
      228,
      251,
      34,
      242,
      193,
      238,
      210,
      144,
      12,
      191,
      179,
      162,
      241,
      81,
      51,
      145,
      235,
      249,
      14,
      239,
      107,
      49,
      192,
      214,
      31,
      181,
      199,
      106,
      157,
      184,
      84,
      204,
      176,
      115,
      121,
      50,
      45,
      127,
      4,
      150,
      254,
      138,
      236,
      205,
      93,
      222,
      114,
      67,
      29,
      24,
      72,
      243,
      141,
      128,
      195,
      78,
      66,
      215,
      61,
      156,
      180
    ];
    // To remove the need for index wrapping, double the permutation table length
    this.perm = new Array(512);
    this.gradP = new Array(512);

    this.seed(seed || 0);
  }

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  Noise.prototype.seed = function(seed) {
    if (seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if (seed < 256) {
      seed |= seed << 8;
    }

    var p = this.p;
    for (var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed >> 8) & 255);
      }

      var perm = this.perm;
      var gradP = this.gradP;
      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = this.grad3[v % 12];
    }
  };

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5 * (Math.sqrt(3) - 1);
  var G2 = (3 - Math.sqrt(3)) / 6;

  var F3 = 1 / 3;
  var G3 = 1 / 6;

  // 2D simplex noise
  Noise.prototype.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin + yin) * F2; // Hairy factor for 2D
    var i = Math.floor(xin + s);
    var j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var x0 = xin - i + t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin - j + t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
      // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1 = 1;
      j1 = 0;
    } else {
      // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1 = 0;
      j1 = 1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;

    var perm = this.perm;
    var gradP = this.gradP;
    var gi0 = gradP[i + perm[j]];
    var gi1 = gradP[i + i1 + perm[j + j1]];
    var gi2 = gradP[i + 1 + perm[j + 1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0); // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  Noise.prototype.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin + yin + zin) * F3; // Hairy factor for 2D
    var i = Math.floor(xin + s);
    var j = Math.floor(yin + s);
    var k = Math.floor(zin + s);

    var t = (i + j + k) * G3;
    var x0 = xin - i + t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin - j + t;
    var z0 = zin - k + t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1;
        j1 = 0;
        k1 = 0;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 1;
        j2 = 0;
        k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0;
        j1 = 0;
        k1 = 1;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else if (x0 < z0) {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 0;
        j2 = 1;
        k2 = 1;
      } else {
        i1 = 0;
        j1 = 1;
        k1 = 0;
        i2 = 1;
        j2 = 1;
        k2 = 0;
      }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;

    var perm = this.perm;
    var gradP = this.gradP;
    var gi0 = gradP[i + perm[j + perm[k]]];
    var gi1 = gradP[i + i1 + perm[j + j1 + perm[k + k1]]];
    var gi2 = gradP[i + i2 + perm[j + j2 + perm[k + k2]]];
    var gi3 = gradP[i + 1 + perm[j + 1 + perm[k + 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.5 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0); // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.5 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);
  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a, b, t) {
    return (1 - t) * a + t * b;
  }

  // 2D Perlin Noise
  Noise.prototype.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x),
      Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X;
    y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255;
    Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var perm = this.perm;
    var gradP = this.gradP;
    var n00 = gradP[X + perm[Y]].dot2(x, y);
    var n01 = gradP[X + perm[Y + 1]].dot2(x, y - 1);
    var n10 = gradP[X + 1 + perm[Y]].dot2(x - 1, y);
    var n11 = gradP[X + 1 + perm[Y + 1]].dot2(x - 1, y - 1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
  };

  // 3D Perlin Noise
  Noise.prototype.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x),
      Y = Math.floor(y),
      Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X;
    y = y - Y;
    z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255;
    Y = Y & 255;
    Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var perm = this.perm;
    var gradP = this.gradP;
    var n000 = gradP[X + perm[Y + perm[Z]]].dot3(x, y, z);
    var n001 = gradP[X + perm[Y + perm[Z + 1]]].dot3(x, y, z - 1);
    var n010 = gradP[X + perm[Y + 1 + perm[Z]]].dot3(x, y - 1, z);
    var n011 = gradP[X + perm[Y + 1 + perm[Z + 1]]].dot3(x, y - 1, z - 1);
    var n100 = gradP[X + 1 + perm[Y + perm[Z]]].dot3(x - 1, y, z);
    var n101 = gradP[X + 1 + perm[Y + perm[Z + 1]]].dot3(x - 1, y, z - 1);
    var n110 = gradP[X + 1 + perm[Y + 1 + perm[Z]]].dot3(x - 1, y - 1, z);
    var n111 = gradP[X + 1 + perm[Y + 1 + perm[Z + 1]]].dot3(x - 1, y - 1, z - 1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
      lerp(lerp(n000, n100, u), lerp(n001, n101, u), w),
      lerp(lerp(n010, n110, u), lerp(n011, n111, u), w),
      v
    );
  };

  window.Noise = Noise;
})(typeof module === "undefined" ? this : module.exports);

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self =
  typeof window !== "undefined"
    ? window // if in browser
    : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope
    ? self // if in worker
    : {}; // if in node js

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(_self) {
  // Private helper vars
  var lang = /\blang(?:uage)?-([\w-]+)\b/i;
  var uniqueId = 0;

  var _ = {
    manual: _self.Prism && _self.Prism.manual,
    disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
    util: {
      encode: function(tokens) {
        if (tokens instanceof Token) {
          return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
        } else if (Array.isArray(tokens)) {
          return tokens.map(_.util.encode);
        } else {
          return tokens
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\u00a0/g, " ");
        }
      },

      type: function(o) {
        return Object.prototype.toString.call(o).slice(8, -1);
      },

      objId: function(obj) {
        if (!obj["__id"]) {
          Object.defineProperty(obj, "__id", { value: ++uniqueId });
        }
        return obj["__id"];
      },

      // Deep clone a language definition (e.g. to extend it)
      clone: function deepClone(o, visited) {
        var clone,
          id,
          type = _.util.type(o);
        visited = visited || {};

        switch (type) {
          case "Object":
            id = _.util.objId(o);
            if (visited[id]) {
              return visited[id];
            }
            clone = {};
            visited[id] = clone;

            for (var key in o) {
              if (o.hasOwnProperty(key)) {
                clone[key] = deepClone(o[key], visited);
              }
            }

            return clone;

          case "Array":
            id = _.util.objId(o);
            if (visited[id]) {
              return visited[id];
            }
            clone = [];
            visited[id] = clone;

            o.forEach(function(v, i) {
              clone[i] = deepClone(v, visited);
            });

            return clone;

          default:
            return o;
        }
      }
    },

    languages: {
      extend: function(id, redef) {
        var lang = _.util.clone(_.languages[id]);

        for (var key in redef) {
          lang[key] = redef[key];
        }

        return lang;
      },

      /**
       * Insert a token before another token in a language literal
       * As this needs to recreate the object (we cannot actually insert before keys in object literals),
       * we cannot just provide an object, we need an object and a key.
       * @param inside The key (or language id) of the parent
       * @param before The key to insert before.
       * @param insert Object with the key/value pairs to insert
       * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
       */
      insertBefore: function(inside, before, insert, root) {
        root = root || _.languages;
        var grammar = root[inside];
        var ret = {};

        for (var token in grammar) {
          if (grammar.hasOwnProperty(token)) {
            if (token == before) {
              for (var newToken in insert) {
                if (insert.hasOwnProperty(newToken)) {
                  ret[newToken] = insert[newToken];
                }
              }
            }

            // Do not insert token which also occur in insert. See #1525
            if (!insert.hasOwnProperty(token)) {
              ret[token] = grammar[token];
            }
          }
        }

        var old = root[inside];
        root[inside] = ret;

        // Update references in other language definitions
        _.languages.DFS(_.languages, function(key, value) {
          if (value === old && key != inside) {
            this[key] = ret;
          }
        });

        return ret;
      },

      // Traverse a language definition with Depth First Search
      DFS: function DFS(o, callback, type, visited) {
        visited = visited || {};

        var objId = _.util.objId;

        for (var i in o) {
          if (o.hasOwnProperty(i)) {
            callback.call(o, i, o[i], type || i);

            var property = o[i],
              propertyType = _.util.type(property);

            if (propertyType === "Object" && !visited[objId(property)]) {
              visited[objId(property)] = true;
              DFS(property, callback, null, visited);
            } else if (propertyType === "Array" && !visited[objId(property)]) {
              visited[objId(property)] = true;
              DFS(property, callback, i, visited);
            }
          }
        }
      }
    },
    plugins: {},

    highlightAll: function(async, callback) {
      _.highlightAllUnder(document, async, callback);
    },

    highlightAllUnder: function(container, async, callback) {
      var env = {
        callback: callback,
        selector:
          'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
      };

      _.hooks.run("before-highlightall", env);

      var elements = container.querySelectorAll(env.selector);

      for (var i = 0, element; (element = elements[i++]); ) {
        _.highlightElement(element, async === true, env.callback);
      }
    },

    highlightElement: function(element, async, callback) {
      // Find language
      var language = "none",
        grammar,
        parent = element;

      while (parent && !lang.test(parent.className)) {
        parent = parent.parentNode;
      }

      if (parent) {
        language = (parent.className.match(lang) || [, "none"])[1].toLowerCase();
        grammar = _.languages[language];
      }

      // Set language on the element, if not present
      element.className =
        element.className.replace(lang, "").replace(/\s+/g, " ") + " language-" + language;

      if (element.parentNode) {
        // Set language on the parent, for styling
        parent = element.parentNode;

        if (/pre/i.test(parent.nodeName)) {
          parent.className =
            parent.className.replace(lang, "").replace(/\s+/g, " ") + " language-" + language;
        }
      }

      var code = element.textContent;

      var env = {
        element: element,
        language: language,
        grammar: grammar,
        code: code
      };

      var insertHighlightedCode = function(highlightedCode) {
        env.highlightedCode = highlightedCode;

        _.hooks.run("before-insert", env);

        env.element.innerHTML = env.highlightedCode;

        _.hooks.run("after-highlight", env);
        _.hooks.run("complete", env);
        callback && callback.call(env.element);
      };

      _.hooks.run("before-sanity-check", env);

      if (!env.code) {
        _.hooks.run("complete", env);
        return;
      }

      _.hooks.run("before-highlight", env);

      if (!env.grammar) {
        insertHighlightedCode(_.util.encode(env.code));
        return;
      }

      if (async && _self.Worker) {
        var worker = new Worker(_.filename);

        worker.onmessage = function(evt) {
          insertHighlightedCode(evt.data);
        };

        worker.postMessage(
          JSON.stringify({
            language: env.language,
            code: env.code,
            immediateClose: true
          })
        );
      } else {
        insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
      }
    },

    highlight: function(text, grammar, language) {
      var env = {
        code: text,
        grammar: grammar,
        language: language
      };
      _.hooks.run("before-tokenize", env);
      env.tokens = _.tokenize(env.code, env.grammar);
      _.hooks.run("after-tokenize", env);
      return Token.stringify(_.util.encode(env.tokens), env.language);
    },

    matchGrammar: function(text, strarr, grammar, index, startPos, oneshot, target) {
      for (var token in grammar) {
        if (!grammar.hasOwnProperty(token) || !grammar[token]) {
          continue;
        }

        if (token == target) {
          return;
        }

        var patterns = grammar[token];
        patterns = _.util.type(patterns) === "Array" ? patterns : [patterns];

        for (var j = 0; j < patterns.length; ++j) {
          var pattern = patterns[j],
            inside = pattern.inside,
            lookbehind = !!pattern.lookbehind,
            greedy = !!pattern.greedy,
            lookbehindLength = 0,
            alias = pattern.alias;

          if (greedy && !pattern.pattern.global) {
            // Without the global flag, lastIndex won't work
            var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
            pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
          }

          pattern = pattern.pattern || pattern;

          // Donâ€™t cache length as it changes during the loop
          for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {
            var str = strarr[i];

            if (strarr.length > text.length) {
              // Something went terribly wrong, ABORT, ABORT!
              return;
            }

            if (str instanceof Token) {
              continue;
            }

            if (greedy && i != strarr.length - 1) {
              pattern.lastIndex = pos;
              var match = pattern.exec(text);
              if (!match) {
                break;
              }

              var from = match.index + (lookbehind ? match[1].length : 0),
                to = match.index + match[0].length,
                k = i,
                p = pos;

              for (
                var len = strarr.length;
                k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy));
                ++k
              ) {
                p += strarr[k].length;
                // Move the index i to the element in strarr that is closest to from
                if (from >= p) {
                  ++i;
                  pos = p;
                }
              }

              // If strarr[i] is a Token, then the match starts inside another Token, which is invalid
              if (strarr[i] instanceof Token) {
                continue;
              }

              // Number of tokens to delete and replace with the new match
              delNum = k - i;
              str = text.slice(pos, p);
              match.index -= pos;
            } else {
              pattern.lastIndex = 0;

              var match = pattern.exec(str),
                delNum = 1;
            }

            if (!match) {
              if (oneshot) {
                break;
              }

              continue;
            }

            if (lookbehind) {
              lookbehindLength = match[1] ? match[1].length : 0;
            }

            var from = match.index + lookbehindLength,
              match = match[0].slice(lookbehindLength),
              to = from + match.length,
              before = str.slice(0, from),
              after = str.slice(to);

            var args = [i, delNum];

            if (before) {
              ++i;
              pos += before.length;
              args.push(before);
            }

            var wrapped = new Token(
              token,
              inside ? _.tokenize(match, inside) : match,
              alias,
              match,
              greedy
            );

            args.push(wrapped);

            if (after) {
              args.push(after);
            }

            Array.prototype.splice.apply(strarr, args);

            if (delNum != 1) _.matchGrammar(text, strarr, grammar, i, pos, true, token);

            if (oneshot) break;
          }
        }
      }
    },

    tokenize: function(text, grammar) {
      var strarr = [text];

      var rest = grammar.rest;

      if (rest) {
        for (var token in rest) {
          grammar[token] = rest[token];
        }

        delete grammar.rest;
      }

      _.matchGrammar(text, strarr, grammar, 0, 0, false);

      return strarr;
    },

    hooks: {
      all: {},

      add: function(name, callback) {
        var hooks = _.hooks.all;

        hooks[name] = hooks[name] || [];

        hooks[name].push(callback);
      },

      run: function(name, env) {
        var callbacks = _.hooks.all[name];

        if (!callbacks || !callbacks.length) {
          return;
        }

        for (var i = 0, callback; (callback = callbacks[i++]); ) {
          callback(env);
        }
      }
    },

    Token: Token
  };

  _self.Prism = _;

  function Token(type, content, alias, matchedStr, greedy) {
    this.type = type;
    this.content = content;
    this.alias = alias;
    // Copy of the full string this token was created from
    this.length = (matchedStr || "").length | 0;
    this.greedy = !!greedy;
  }

  Token.stringify = function(o, language) {
    if (typeof o == "string") {
      return o;
    }

    if (Array.isArray(o)) {
      return o
        .map(function(element) {
          return Token.stringify(element, language);
        })
        .join("");
    }

    var env = {
      type: o.type,
      content: Token.stringify(o.content, language),
      tag: "span",
      classes: ["token", o.type],
      attributes: {},
      language: language
    };

    if (o.alias) {
      var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
      Array.prototype.push.apply(env.classes, aliases);
    }

    _.hooks.run("wrap", env);

    var attributes = Object.keys(env.attributes)
      .map(function(name) {
        return name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
      })
      .join(" ");

    return (
      "<" +
      env.tag +
      ' class="' +
      env.classes.join(" ") +
      '"' +
      (attributes ? " " + attributes : "") +
      ">" +
      env.content +
      "</" +
      env.tag +
      ">"
    );
  };

  if (!_self.document) {
    if (!_self.addEventListener) {
      // in Node.js
      return _;
    }

    if (!_.disableWorkerMessageHandler) {
      // In worker
      _self.addEventListener(
        "message",
        function(evt) {
          var message = JSON.parse(evt.data),
            lang = message.language,
            code = message.code,
            immediateClose = message.immediateClose;

          _self.postMessage(_.highlight(code, _.languages[lang], lang));
          if (immediateClose) {
            _self.close();
          }
        },
        false
      );
    }

    return _;
  }

  //Get current script and highlight
  var script =
    document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

  if (script) {
    _.filename = script.src;

    if (!_.manual && !script.hasAttribute("data-manual")) {
      if (document.readyState !== "loading") {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(_.highlightAll);
        } else {
          window.setTimeout(_.highlightAll, 16);
        }
      } else {
        document.addEventListener("DOMContentLoaded", _.highlightAll);
      }
    }
  }

  return _;
})(_self);

if (typeof module !== "undefined" && module.exports) {
  module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== "undefined") {
  window.Prism = Prism;
}

/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
  comment: /<!--[\s\S]*?-->/,
  prolog: /<\?[\s\S]+?\?>/,
  doctype: /<!DOCTYPE[\s\S]+?>/i,
  cdata: /<!\[CDATA\[[\s\S]*?]]>/i,
  tag: {
    pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,
    greedy: true,
    inside: {
      tag: {
        pattern: /^<\/?[^\s>\/]+/i,
        inside: {
          punctuation: /^<\/?/,
          namespace: /^[^\s>\/:]+:/
        }
      },
      "attr-value": {
        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
        inside: {
          punctuation: [
            /^=/,
            {
              pattern: /^(\s*)["']|["']$/,
              lookbehind: true
            }
          ]
        }
      },
      punctuation: /\/?>/,
      "attr-name": {
        pattern: /[^\s>\/]+/,
        inside: {
          namespace: /^[^\s>\/:]+:/
        }
      }
    }
  },
  entity: /&#?[\da-z]{1,8};/i
};

Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] =
  Prism.languages.markup["entity"];

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add("wrap", function(env) {
  if (env.type === "entity") {
    env.attributes["title"] = env.content.replace(/&amp;/, "&");
  }
});

Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
  /**
   * Adds an inlined language to markup.
   *
   * An example of an inlined language is CSS with `<style>` tags.
   *
   * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
   * case insensitive.
   * @param {string} lang The language key.
   * @example
   * addInlined('style', 'css');
   */
  value: function addInlined(tagName, lang) {
    var includedCdataInside = {};
    includedCdataInside["language-" + lang] = {
      pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
      lookbehind: true,
      inside: Prism.languages[lang]
    };
    includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;

    var inside = {
      "included-cdata": {
        pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
        inside: includedCdataInside
      }
    };
    inside["language-" + lang] = {
      pattern: /[\s\S]+/,
      inside: Prism.languages[lang]
    };

    var def = {};
    def[tagName] = {
      pattern: RegExp(
        /(<__[\s\S]*?>)(?:<!\[CDATA\[[\s\S]*?\]\]>\s*|[\s\S])*?(?=<\/__>)/.source.replace(
          /__/g,
          tagName
        ),
        "i"
      ),
      lookbehind: true,
      greedy: true,
      inside: inside
    };

    Prism.languages.insertBefore("markup", "cdata", def);
  }
});

Prism.languages.xml = Prism.languages.extend("markup", {});
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;

/* **********************************************
     Begin prism-css.js
********************************************** */

(function(Prism) {
  var string = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;

  Prism.languages.css = {
    comment: /\/\*[\s\S]*?\*\//,
    atrule: {
      pattern: /@[\w-]+[\s\S]*?(?:;|(?=\s*\{))/,
      inside: {
        rule: /@[\w-]+/
        // See rest below
      }
    },
    url: {
      pattern: RegExp("url\\((?:" + string.source + "|[^\n\r()]*)\\)", "i"),
      inside: {
        function: /^url/i,
        punctuation: /^\(|\)$/
      }
    },
    selector: RegExp("[^{}\\s](?:[^{};\"']|" + string.source + ")*?(?=\\s*\\{)"),
    string: {
      pattern: string,
      greedy: true
    },
    property: /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
    important: /!important\b/i,
    function: /[-a-z0-9]+(?=\()/i,
    punctuation: /[(){};:,]/
  };

  Prism.languages.css["atrule"].inside.rest = Prism.languages.css;

  var markup = Prism.languages.markup;
  if (markup) {
    markup.tag.addInlined("style", "css");

    Prism.languages.insertBefore(
      "inside",
      "attr-value",
      {
        "style-attr": {
          pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
          inside: {
            "attr-name": {
              pattern: /^\s*style/i,
              inside: markup.tag.inside
            },
            punctuation: /^\s*=\s*['"]|['"]\s*$/,
            "attr-value": {
              pattern: /.+/i,
              inside: Prism.languages.css
            }
          },
          alias: "language-css"
        }
      },
      markup.tag
    );
  }
})(Prism);

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
  comment: [
    {
      pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
      lookbehind: true
    },
    {
      pattern: /(^|[^\\:])\/\/.*/,
      lookbehind: true,
      greedy: true
    }
  ],
  string: {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true
  },
  "class-name": {
    pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
    lookbehind: true,
    inside: {
      punctuation: /[.\\]/
    }
  },
  keyword: /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
  boolean: /\b(?:true|false)\b/,
  function: /\w+(?=\()/,
  number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  operator: /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
  punctuation: /[{}[\];(),.:]/
};

/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend("clike", {
  "class-name": [
    Prism.languages.clike["class-name"],
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])[_$A-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\.(?:prototype|constructor))/,
      lookbehind: true
    }
  ],
  keyword: [
    {
      pattern: /((?:^|})\s*)(?:catch|finally)\b/,
      lookbehind: true
    },
    {
      pattern: /(^|[^.])\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
      lookbehind: true
    }
  ],
  number: /\b(?:(?:0[xX](?:[\dA-Fa-f](?:_[\dA-Fa-f])?)+|0[bB](?:[01](?:_[01])?)+|0[oO](?:[0-7](?:_[0-7])?)+)n?|(?:\d(?:_\d)?)+n|NaN|Infinity)\b|(?:\b(?:\d(?:_\d)?)+\.?(?:\d(?:_\d)?)*|\B\.(?:\d(?:_\d)?)+)(?:[Ee][+-]?(?:\d(?:_\d)?)+)?/,
  // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
  function: /#?[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
  operator: /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.javascript[
  "class-name"
][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore("javascript", "keyword", {
  regex: {
    pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyus]{0,6}(?=\s*($|[\r\n,.;})\]]))/,
    lookbehind: true,
    greedy: true
  },
  // This must be declared before keyword because we use "function" inside the look-forward
  "function-variable": {
    pattern: /#?[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/,
    alias: "function"
  },
  parameter: [
    {
      pattern: /(function(?:\s+[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)?\s*\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\))/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=>)/i,
      inside: Prism.languages.javascript
    },
    {
      pattern: /(\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*=>)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    },
    {
      pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\s*)\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*\{)/,
      lookbehind: true,
      inside: Prism.languages.javascript
    }
  ],
  constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore("javascript", "string", {
  "template-string": {
    pattern: /`(?:\\[\s\S]|\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}|(?!\${)[^\\`])*`/,
    greedy: true,
    inside: {
      "template-punctuation": {
        pattern: /^`|`$/,
        alias: "string"
      },
      interpolation: {
        pattern: /((?:^|[^\\])(?:\\{2})*)\${(?:[^{}]|{(?:[^{}]|{[^}]*})*})+}/,
        lookbehind: true,
        inside: {
          "interpolation-punctuation": {
            pattern: /^\${|}$/,
            alias: "punctuation"
          },
          rest: Prism.languages.javascript
        }
      },
      string: /[\s\S]+/
    }
  }
});

if (Prism.languages.markup) {
  Prism.languages.markup.tag.addInlined("script", "javascript");
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function() {
  if (typeof self === "undefined" || !self.Prism || !self.document || !document.querySelector) {
    return;
  }

  /**
   * @param {Element} [container=document]
   */
  self.Prism.fileHighlight = function(container) {
    container = container || document;

    var Extensions = {
      js: "javascript",
      py: "python",
      rb: "ruby",
      ps1: "powershell",
      psm1: "powershell",
      sh: "bash",
      bat: "batch",
      h: "c",
      tex: "latex"
    };

    Array.prototype.slice.call(container.querySelectorAll("pre[data-src]")).forEach(function(pre) {
      // ignore if already loaded
      if (pre.hasAttribute("data-src-loaded")) {
        return;
      }

      // load current
      var src = pre.getAttribute("data-src");

      var language,
        parent = pre;
      var lang = /\blang(?:uage)?-([\w-]+)\b/i;
      while (parent && !lang.test(parent.className)) {
        parent = parent.parentNode;
      }

      if (parent) {
        language = (pre.className.match(lang) || [, ""])[1];
      }

      if (!language) {
        var extension = (src.match(/\.(\w+)$/) || [, ""])[1];
        language = Extensions[extension] || extension;
      }

      var code = document.createElement("code");
      code.className = "language-" + language;

      pre.textContent = "";

      code.textContent = "Loadingâ€¦";

      pre.appendChild(code);

      var xhr = new XMLHttpRequest();

      xhr.open("GET", src, true);

      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status < 400 && xhr.responseText) {
            code.textContent = xhr.responseText;

            Prism.highlightElement(code);
            // mark as loaded
            pre.setAttribute("data-src-loaded", "");
          } else if (xhr.status >= 400) {
            code.textContent =
              "âœ– Error " + xhr.status + " while fetching file: " + xhr.statusText;
          } else {
            code.textContent = "âœ– Error: File does not exist or is empty";
          }
        }
      };

      xhr.send(null);
    });

    if (Prism.plugins.toolbar) {
      Prism.plugins.toolbar.registerButton("download-file", function(env) {
        var pre = env.element.parentNode;
        if (
          !pre ||
          !/pre/i.test(pre.nodeName) ||
          !pre.hasAttribute("data-src") ||
          !pre.hasAttribute("data-download-link")
        ) {
          return;
        }
        var src = pre.getAttribute("data-src");
        var a = document.createElement("a");
        a.textContent = pre.getAttribute("data-download-link-label") || "Download";
        a.setAttribute("download", "");
        a.href = src;
        return a;
      });
    }
  };

  document.addEventListener("DOMContentLoaded", function() {
    // execute inside handler, for dropping Event as argument
    self.Prism.fileHighlight();
  });
})();

("use strict");

(function($) {
  $(function() {
    /**
     * Swiper Initialization
     **/
    $(".swiper-container").each(function() {
      var $this = $(this);
      var boolData = {
        breakpoints: $this.data("sw-breakpoints"),
        active_selector: $this.data("sw-active-selector"),
        cover_flow: $this.data("sw-coverflow"),
        auto_play: $this.data("sw-autoplay"),
        loop: $this.data("sw-loop"),
        centered: $this.data("sw-centered-slides"),
        pagination: $this.data("sw-pagination"),
        nav_arrows: $this.data("sw-nav-arrows")
      };

      var breakPoints = boolData.breakpoints || false;
      var auto_play = boolData.auto_play !== undefined ? boolData.auto_play : false;
      var speed = $this.data("sw-speed") || 1100;
      var effect = $this.data("sw-effect") || "slide";
      var showItems = $this.data("sw-show-items") || 1;
      var loop = boolData.loop !== undefined ? boolData.loop : true;
      var centered = boolData.centered !== undefined ? boolData.centered : true;
      var spaceBetween = $this.data("sw-space-between") || (showItems > 1 ? 20 : 0);
      var scrollItems = $this.data("sw-scroll-items") || 1;
      var navigationElement = $this.data("sw-navigation");
      var navigationActiveClass = $this.data("sw-navigation-active") || "active";
      var navigationActiveSelector =
        boolData.active_selector !== undefined ? boolData.active_selector : false;
      var paginationCss =
        boolData.pagination !== undefined ? boolData.pagination : ".swiper-pagination";
      var navigationCss =
        boolData.nav_arrows !== undefined ? boolData.nav_arrows : ".swiper-button";

      var coverflow = boolData.cover_flow
        ? {
            coverflowEffect: $.extend(
              {
                stretch: 0,
                depth: 0,
                modifier: 1,
                rotate: 0,
                slideShadows: false
              },
              boolData.cover_flow
            )
          }
        : {};

      var autoplay = auto_play
        ? {
            autoplay: {
              delay: auto_play,
              disableOnIteration: false
            },
            speed: speed
          }
        : {};

      var pagination = {};

      if (paginationCss) {
        pagination.pagination = {
          el: paginationCss,
          clickable: true,
          dynamicBullets: true
        };
      }

      if (navigationCss) {
        pagination.navigation = {
          nextEl: navigationCss + "-next",
          prevEl: navigationCss + "-prev"
        };
      }

      var events = {};

      /**/ if (navigationElement) {
        events = {
          transitionEnd: function() {
            if (!navigationElement) return;

            var $navigationElement = $(navigationElement);

            if (navigationActiveSelector) {
              $(
                navigationActiveSelector + "." + navigationActiveClass,
                $navigationElement
              ).removeClass(navigationActiveClass);
              $(
                ".nav-item:eq(" + swiper.realIndex + ") " + navigationActiveSelector,
                $navigationElement
              ).addClass(navigationActiveClass);
            } else {
              $("." + navigationActiveClass, $navigationElement).removeClass(navigationActiveClass);
              $(".nav-item:eq(" + swiper.realIndex + ")", $navigationElement).addClass(
                navigationActiveClass
              );
            }
          }
        };
      } /**/

      var options = $.extend(
        {
          loop: loop,
          slidesPerGroup: scrollItems,
          spaceBetween: spaceBetween,
          centeredSlides: centered,
          breakpoints: breakPoints,
          slidesPerView: showItems,
          parallax: true,
          effect: effect
        },
        pagination,
        autoplay,
        coverflow
      );

      var swiper = new window.Swiper(this, options);

      for (var e in events) {
        swiper.on(e, events[e]);
      }

      if (navigationElement) {
        $(navigationElement).on("click", ".nav-item", function(evt) {
          evt.preventDefault();

          var $item = $(this);
          var $activeItem = $item;

          if (navigationActiveSelector) {
            $activeItem = $(navigationActiveSelector, $item);
          }

          if ($activeItem.hasClass(navigationActiveClass)) {
            return false;
          }

          var index = $item.data("step") || $item.index() + 1;
          swiper.slideTo(index);

          if (navigationActiveSelector) {
            $item.siblings().each(function() {
              $(navigationActiveSelector, this).removeClass(navigationActiveClass);
            });

            $activeItem.addClass(navigationActiveClass);
          } else {
            $item.siblings("." + navigationActiveClass).removeClass(navigationActiveClass);
            $item.addClass(navigationActiveClass);
          }

          return false;
        });
      }
    });

    $(".scroll-bar").each(function(i, e) {
      var bar = new SimpleBar(e);
    });
  });
})(jQuery);

/*!
 * jquery.animatebar.js 1.1
 *
 * Copyright 2018, 5Studios.net https://www.5studios.net
 * Released under the GPL v2 License
 *
 * Date: Sep 13, 2018
 */
(function($) {
  "use strict";

  var defaults = {
    delay: 100,
    step: 0,
    duration: 3000,
    orientation: "horizontal"
  };

  function AnimateBar(element, options) {
    this.config = options;
    this.element = element; //DOM element
    this.isHorizontal = this.config.orientation === "horizontal";

    this.init();
  }

  AnimateBar.prototype.init = function() {
    var t = this;

    new Waypoint({
      element: t.element,
      handler: function() {
        AnimateBar.prototype.animate.apply(t, null);
        this.destroy();
      },
      offset: "100%"
    });
  };

  AnimateBar.prototype.animate = function() {
    var $element = $(this.element);
    var percent = $element.data("percent");
    var config = this.config;
    var isHorizontal = this.isHorizontal;

    setTimeout(function() {
      if (isHorizontal) {
        $(".progress-bar", $element).animate(
          {
            width: percent + "%"
          },
          config.duration
        );
      } else {
        $(".progress-bar", $element).animate(
          {
            height: percent + "%"
          },
          config.duration
        );
      }
    }, config.delay + config.step);
  };

  function BarChart(element, options) {
    this.config = $.extend({}, defaults, options);
    this.tag = element; //DOM element
    this.elements = options.elements; // Bars to generate

    this.renderBars();
    this.createAnimation();
  }

  BarChart.prototype.renderBars = function() {
    var options = this.config;
    var orientation = options.orientation;

    var bars = [];

    this.elements.forEach(function(element) {
      var barSize = 100;
      var percent = element.value;
      var style = element.style || {};

      var $progressBar = $("<div/>", {
        class: "progress-bar"
      });
      var $bar = $("<div/>", {
        class: "progress " + (style.progress || "progress-default"),
        html: $progressBar
      }).data("percent", percent);

      if (orientation === "horizontal") {
        $bar.css({ width: barSize + "%" });
        $progressBar.css({ width: 0 });
      } else {
        $bar.css({ height: barSize + "%" });
        $progressBar.css({ height: 0 });
      }

      var $legend = $("<p>", {
        html: [element.label, $("<span>", { html: percent + "%" })]
      });

      var $li = $("<li/>", { html: [$legend, $bar] });

      //$bar.data("animation", new AnimateBar($bar[0], $.extend({}, options, { step: (1 + index) * options.step })));

      bars.push($li);
    });

    $(this.tag)
      .append(bars)
      .addClass("progress-" + orientation);
  };

  BarChart.prototype.createAnimation = function() {
    var options = this.config;

    $("li .progress", this.tag).each(function(index) {
      $(this).data(
        "animation",
        new AnimateBar(this, {
          delay: options.delay,
          step: (1 + index) * options.step,
          duration: options.duration,
          orientation: options.orientation
        })
      );
    });
  };

  $.fn.animateBar = function(options) {
    return this.each(function() {
      new BarChart(this, options);
    });
  };
})(jQuery);

("use strict");

// utils for cookie-law plugin
window["cookieconsent_example_util"] = {
  // Fill a select element with options (html can be configured using `cb`)
  fillSelect: function(select, options, selected, cb) {
    if (!select) return;

    var html = "";
    if (typeof cb !== "function") {
      cb = this.getSimpleOption;
    }
    for (var prop in options) {
      html += cb(options[prop], prop, prop == selected);
    }
    select.innerHTML = html;
  },

  getSimpleOption: function(label, value, selected) {
    return (
      "<option " +
      (selected ? 'selected="selected"' : "") +
      ' value="' +
      value +
      '">' +
      label +
      "</option>"
    );
  },

  tabularObject: function(obj, formatVal, formatKey) {
    var html = "<ul>";
    var defaultFn = function() {
      return arguments[0];
    };

    if (typeof formatKey !== "function") formatKey = defaultFn;
    if (typeof formatVal !== "function") formatVal = defaultFn;

    for (var prop in obj) {
      html +=
        "<li><em>" + formatKey(prop, obj[prop]) + "</em> " + formatVal(obj[prop], prop) + "</li>";
    }
    return html + "</ul>";
  },

  initialisePopupSelector: function(options) {
    if (!options.selector) return;

    var examples = Object.keys(options.popups);
    var itemOpen = "<li><span>";
    var itemClose = "</span></li>";
    var instances = [];

    options.selector.innerHTML =
      itemOpen + Object.keys(options.popups).join(itemClose + itemOpen) + itemClose;

    options.selector.onclick = function(e) {
      var targ = e.target,
        item;

      // if the target is the container, exit
      if (targ.isEqualNode(options.selector)) return;

      // from this point, only the child elements of opts.selector will get through.
      // out of these child elements, we want to find the closest direct decendant <li>
      while (targ.tagName !== "LI" && targ.parentNode) {
        targ = targ.parentNode;
      }

      if (!targ.parentNode.isEqualNode(options.selector)) return;

      // from this point, 'targ' will be a direct decendant of opts.selector
      var idx = Array.prototype.indexOf.call(options.selector.children, targ);

      if (idx >= 0 && instances[idx]) {
        instances[idx].clearStatus();

        // We could remember the popup that's currently open, but it gets complicated when we consider
        // the revoke button. Therefore, simply close them all regardless
        instances.forEach(function(popup) {
          if (popup.isOpen()) {
            popup.close();
          }
          popup.toggleRevokeButton(false);
        });

        instances[idx].open();
      }
    };

    for (var i = 0, l = examples.length; i < l; ++i) {
      options.popups[examples[i]].onPopupOpen = (function(options) {
        return function() {
          var codediv = document.getElementById("options");
          if (codediv) {
            codediv.innerHTML = JSON.stringify(options, null, 2);
          }
        };
      })(options.popups[examples[i]]);

      var myOpts = options.popups[examples[i]];

      myOpts.autoOpen = false;

      options.cookieconsent.initialise(
        myOpts,
        function(idx, popup) {
          instances[idx] = popup;
        }.bind(null, i),
        function(idx, err, popup) {
          instances[idx] = popup;
          console.error(err);
        }.bind(null, i)
      );
    }

    return instances;
  }
};
("use strict");

(function(C, U) {
  var palettes = {
    honeybee: {
      popup: { background: "#000" },
      button: { background: "#f1d600", padding: "5px 25px" }
    },
    blurple: { popup: { background: "#3937a3" }, button: { background: "#e62576" } },
    mono: {
      popup: { background: "#237afc" },
      button: { background: "transparent", border: "#fff", text: "#fff", padding: "5px 40px" }
    },
    nuclear: {
      popup: { background: "#aa0000", text: "#ffdddd" },
      button: { background: "#ff0000" }
    },
    cosmo: {
      popup: { background: "#383b75" },
      button: { background: "#f1d600", padding: "5px 50px" }
    },
    neon: { popup: { background: "#1d8a8a" }, button: { background: "#62ffaa" } },
    corporate: {
      popup: { background: "#edeff5", text: "#838391" },
      button: { background: "#4b81e8" }
    }
  };

  var cookiePopups = U.initialisePopupSelector({
    cookieconsent: C,
    selector: document.querySelector(".example-selector-themes"),
    popups: {
      Mono: {
        type: "info",
        position: "bottom",
        palette: palettes.mono
      },
      Honeybee: {
        type: "info",
        position: "top",
        palette: palettes.honeybee
      },
      Blurple: {
        type: "opt-out",
        position: "bottom-left",
        palette: palettes.blurple,
        content: {
          message: "You can override the text that appears in an alert too.",
          dismiss: "Awesome"
        }
      },
      Nuclear: {
        type: "info",
        position: "bottom-right",
        theme: "edgeless",
        palette: palettes.nuclear,
        content: {
          dismiss: "I accept certain doom"
        }
      },
      Cosmo: {
        type: "opt-out",
        position: "bottom",
        palette: palettes.cosmo
      },
      Neon: {
        type: "info",
        theme: "classic",
        position: "bottom-left",
        palette: palettes.neon
      } /*,
            'Corporate': {
                type: 'info',
                position: 'top',
                palette: palettes.corporate,
                static: true,
                content: {
                    "dismiss": "Dismiss"
                }
            }*/
    }
  });
})(window.cookieconsent, window.cookieconsent_example_util);

("use strict");

(function(C, U) {
  var pageState = U.initialisePopupSelector({
    cookieconsent: C,
    selector: document.querySelector(".example-selector-custom-css"),
    popups: {
      "Click me": {
        theme: "custom"
      }
    }
  });
})(window.cookieconsent, window.cookieconsent_example_util);
("use strict");

(function(C, U) {
  var pageState = U.initialisePopupSelector({
    cookieconsent: C,
    selector: document.querySelector(".example-selector-informational"),
    popups: {
      "Try it": {
        type: "info",
        palette: { popup: { background: "#383b75" }, button: { background: "#f1d600" } }
      }
    }
  });
})(window.cookieconsent, window.cookieconsent_example_util);
("use strict");

(function(C, U) {
  var pageState = U.initialisePopupSelector({
    cookieconsent: C,
    selector: document.querySelector(".example-selector-opt-out"),
    popups: {
      "Try it": {
        type: "opt-out",
        palette: { popup: { background: "#383b75" }, button: { background: "#f1d600" } }
      }
    }
  });
})(window.cookieconsent, window.cookieconsent_example_util);
("use strict");

(function(C, U) {
  var pageState = U.initialisePopupSelector({
    cookieconsent: C,
    selector: document.querySelector(".example-selector-opt-in"),
    popups: {
      "Try it": {
        type: "opt-in",
        palette: { popup: { background: "#383b75" }, button: { background: "#f1d600" } }
      }
    }
  });
})(window.cookieconsent, window.cookieconsent_example_util);

("use strict");

var COUNTRY_CODES = {
  // Representative group of countries with key differences
  US: "United States",
  UK: "United Kingdom",
  ES: "Spain",
  DE: "Germany",
  BE: "Belgium",
  "": "-----------------------------",

  // Every other country
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AG: "Antigua And Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BZ: "Belize",
  BJ: "Benin",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia And Herzegovina",
  BW: "Botswana",
  BR: "Brazil",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CX: "Christmas Island",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo",
  CD: "Congo, Democratic Republic",
  CR: "Costa Rica",
  CI: "Cote D'Ivoire",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  EE: "Estonia",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  GH: "Ghana",
  GR: "Greece",
  GL: "Greenland",
  GD: "Grenada",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  VA: "Holy See (Vatican City State)",
  HN: "Honduras",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KI: "Kiribati",
  KP: "Korea, North",
  KR: "Korea, South",
  KS: "Kosovo",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MK: "Macedonia",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MH: "Marshall Islands",
  MR: "Mauritania",
  MU: "Mauritius",
  MX: "Mexico",
  FM: "Micronesia",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NL: "Netherlands",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PW: "Palau",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",
  KN: "Saint Kitts And Nevis",
  LC: "Saint Lucia",
  VC: "Saint Vincent And Grenadines",
  WS: "Samoa",
  SM: "San Marino",
  ST: "Sao Tome And Principe",
  SA: "Saudi Arabia",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SB: "Solomon Islands",
  SO: "Somalia",
  ZA: "South Africa",
  SS: "South Sudan",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SZ: "Swaziland",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TK: "Tokelau",
  TO: "Tonga",
  TT: "Trinidad And Tobago",
  TN: "Tunisia",
  TR: "Turkey",
  TM: "Turkmenistan",
  TV: "Tuvalu",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VU: "Vanuatu",
  VE: "Venezuela",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe"
};

(function(C, U) {
  var popupInst;
  var $loc = document.getElementById("cookie-law-location");

  if (!$loc) return;

  U.fillSelect($loc, COUNTRY_CODES, COUNTRY_CODES["AC"]);

  $loc.onchange = function() {
    var code = $loc.selectedIndex >= 0 ? $loc[$loc.selectedIndex].value : undefined;

    if (!code) return;

    draw(code);
  };

  draw($loc[0].value);

  // $loc.focus();

  function draw(code) {
    var options = getOptions(code);

    if (popupInst) {
      popupInst.clearStatus();
      popupInst.destroy();
      popupInst = null;
    }

    cookieconsent.initialise(
      options,
      function(popup) {
        popupInst = popup;
        popupInst.autoOpen();
      },
      function(err) {
        console.error(err);
      }
    );

    // show country options on screen (so user knows how this country affected the settings)
    document.getElementById("message").innerHTML = getCountryDetails(code);
  }

  function getOptions(code) {
    return {
      type: "info",
      regionalLaw: true,
      palette: {
        popup: { background: "#343c66", text: "#cfcfe8" },
        button: { background: "#f71559" }
      },
      law: {
        // takes the "preferred" options and changes them slightly to match the country's law
        countryCode: code
      }
    };
  }

  function getCountryDetails(code) {
    // We only get these to show (on screen) how the country behaves
    var law = new cookieconsent.Law({});
    var countryOpts = law.get(code);

    if (!countryOpts.hasLaw) {
      return "Has cookie law? no";
    }

    return U.tabularObject({
      "Has cookie law?": "yes",
      "Choice has to be revokable?": countryOpts.revokable ? "yes" : "no",
      "Can be automatically dismissed?": countryOpts.explicitAction ? "no" : "yes"
    });
  }
})(window.cookieconsent, window.cookieconsent_example_util);

/**
 * FOR DEMO PURPOSES ONLY
 **/

("use strict");

// document ready
$(function() {
  var $accordionColorSelector = $("#accordion-theme-current");
  var $accordion = $("#accordion-colored");

  $accordion.addClass("accordion-" + $accordion.data("current"));
  $accordionColorSelector.addClass("btn-outline-" + $accordion.data("current"));

  $("#demo-accordion-theme-selector").on("click", ".dropdown-item", function(e) {
    e.preventDefault();

    var color = $(this).data("color");
    var current = $accordion.data("current");

    $accordion.removeClass("accordion-" + current).addClass("accordion-" + color);

    $accordion.data("current", color);

    // Update the selector text
    $accordionColorSelector.html(color);
    $accordionColorSelector.removeClass("btn-outline-" + current).addClass("btn-outline-" + color);
  });

  $(".navigation", ".demo-blocks").each(function(i, e) {
    var $element = $(e);

    $(".navbar-toggler", e).on("click", function() {
      $element.toggleClass("navbar-expanded");
    });
  });

  /**
   * ANIMATION BAR
   **/
  (function() {
    $(".horizontal-demo-bars").animateBar({
      orientation: "horizontal",
      step: 100,
      duration: 1000,
      elements: [
        { label: "Implementation", value: 89 }, // style: { progress: "progress-4" }
        { label: "Design", value: 97 },
        { label: "Branding", value: 81 },
        { label: "Beauty", value: 99 },
        { label: "Responsiveness", value: 99 }
      ]
    });

    $(".vertical-demo-bars").animateBar({
      orientation: "vertical",
      step: 100,
      duration: 1000,
      elements: [{ value: 89 }, { value: 97 }, { value: 81 }, { value: 99 }, { value: 99 }]
    });
  })();
});

/*!
 Dashcore - HTML Startup Template, v1.0
 Forms JS file
 Copyright Â© 2018 5Studios.net
 http://5studios.net
 */

("use strict");
$(function($) {
  $("form").each(function() {
    var $form = $(this);
    var options = {
      // ignore: [], // uncomment this in case you need to validate :hidden inputs ([type=hidden], display:none are considered :hidden)
      errorPlacement: function(error, element) {
        var $parent = element.parent();

        if ($parent.hasClass("input-group")) {
          error.insertAfter($parent);
        } else if ($parent.hasClass("has-icon")) {
          error.insertBefore($parent);
        } else if ($parent.hasClass("control")) {
          error.insertAfter(element.next(".control-label"));
        } else {
          error.insertAfter(element);
        }
      }
    };

    if ($form.data("validate-on") == "submit") {
      $.extend(options, {
        onfocusout: false,
        onkeyup: false
      });
    }

    // call to validate plugin
    $form.validate(options);
  });

  $("form").submit(function(evt) {
    evt.preventDefault();
    var $form = $(this);

    if (!$form.valid()) {
      return false;
    }

    var $submit = $("button[type=submit]", this);
    $submit.addClass("loading");

    var $ajaxButton = $submit.parent(".ajax-button");
    var hasAjaxButton = $ajaxButton.length;
    var $message = $form.next(".response-message");

    function doAjax(url, data, config) {
      var settings = $.extend(true, {}, config, {
        url: url,
        type: "POST",
        data: data,
        dataType: "json"
      });

      $.ajax(settings)
        .done(function(data) {
          if (data.result) {
            //setTimeout(function() {
            $form.trigger("form.submitted", [data]);
            //}, 1000);

            $("input, textarea", $form).removeClass("error");
            $(".response", $message).html(data.message);

            // restore button defaults
            if (hasAjaxButton) {
              $(".success", $ajaxButton).addClass("done");
            }

            $form.addClass("submitted");
            $form[0].reset();
          } else {
            if (hasAjaxButton) {
              $(".failed", $ajaxButton).addClass("done");
            }

            if (data.errors) {
              $.each(data.errors, function(i, v) {
                var $input = $("[name$='[" + i + "]']", $form).addClass("error");
                $input
                  .tooltip({ title: v, placement: "bottom", trigger: "manual" })
                  .tooltip("show")
                  .on("focus", function() {
                    $(this).tooltip("dispose");
                  });
              });
            }
          }
        })
        .fail(function() {
          $(".response", $message).html($("<span class='block'>Something went wrong.</span>"));
          if (hasAjaxButton) {
            $(".failed", $ajaxButton).addClass("done");
          }
        })
        .always(function() {
          $submit.addClass("loading-end");

          if (hasAjaxButton) {
            setTimeout(function() {
              console.log("clearing status");
              $submit.removeClass("loading").removeClass("loading-end");
              $(".success,.failed", $ajaxButton).removeClass("done");
            }, 500);
          }
          //some other stuffs
        });
    }

    function submitAjax($form) {
      doAjax($form.attr("action"), $form.serializeArray());
    }

    submitAjax($form);

    return false;
  });
});

/**
 * Title:   Dashcore - HTML App Landing Page - Main Javascript file
 * Author:  http://themeforest.net/user/5studiosnet
 **/

(function() {
  "use strict";

  // Avoid `console` errors in browsers that lack a console.
  var method;
  var noop = function() {};
  var methods = [
    "assert",
    "clear",
    "count",
    "debug",
    "dir",
    "dirxml",
    "error",
    "exception",
    "group",
    "groupCollapsed",
    "groupEnd",
    "info",
    "log",
    "markTimeline",
    "profile",
    "profileEnd",
    "table",
    "time",
    "timeEnd",
    "timeline",
    "timelineEnd",
    "timeStamp",
    "trace",
    "warn"
  ];
  var length = methods.length;
  var console = (window.console = window.console || {});

  while (length--) {
    method = methods[length];

    // Only stub undefined methods.
    if (!console[method]) {
      console[method] = noop;
    }
  }
})();

// Place any code in here.
$(function() {
  "use strict";

  /** navbar reference **/
  var $navbar = $(".main-nav"),
    stickyPoint = 90;

  /** Perspective mockups reference **/
  var $perspectiveMockups = $(".perspective-mockups");

  // This element is used as reference for relocation of the mockups on mobile devices.
  // If you remove it please be sure you add another reference element preferably within the same section and/or position the button was.
  // You can change the selector (".learn-more") to one that uniquely identifies the reference element.
  var $topReference = $(".learn-more", ".lightweight-template");

  var setMockupsTop = function() {
    // check if the perspective mockups elements are on the page, if you're not going to use them, you can remove all its references
    if (!$perspectiveMockups.length) return;

    if ($(window).outerWidth() < 768) {
      $perspectiveMockups.css({ top: $topReference.offset().top + "px" });
      return;
    }

    $perspectiveMockups.removeAttr("style");
  };

  var navbarSticky = function() {
    if ($(window).scrollTop() >= stickyPoint) {
      $navbar.addClass("navbar-sticky");
    } else {
      $navbar.removeClass("navbar-sticky");
    }
  };

  /**
   * STICKY MENU
   **/
  $(window).on("scroll", navbarSticky);

  navbarSticky();

  /**
   * SCROLLING NAVIGATION
   * Enable smooth transition animation when scrolling
   **/
  $("a.scrollto").on("click", function(event) {
    event.preventDefault();

    var scrollAnimationTime = 1200;
    var target = this.hash;

    $("html, body")
      .stop()
      .animate(
        {
          scrollTop: $(target).offset().top - 45
        },
        scrollAnimationTime,
        "easeInOutExpo",
        function() {
          window.location.hash = target;
        }
      );
  });

  /**
   *  NAVBAR SIDE COLLAPSIBLE - On Mobiles
   **/
  $(".navbar-toggler", $navbar).on("click", function() {
    if (!$navbar.is(".st-nav")) $navbar.toggleClass("navbar-expanded");
  });

  /**
   * Blog interaction with buttons: favorite and bookmark
   **/
  $(".card-blog").on(
    {
      click: function(e) {
        e.preventDefault();

        var $el = $(this)
          .removeClass("far")
          .addClass("fas");
        if ($el.hasClass("favorite")) {
          $el.addClass("text-danger");
        } else {
          $el.addClass("text-warning");
        }
      },
      mouseenter: function() {
        $(this).addClass("fas");
      },
      mouseleave: function() {
        $(this).removeClass("fas");
      }
    },
    "i.far"
  );

  /**
   * Position the perspective mockups at the end of the first content section on mobile
   **/
  $perspectiveMockups.removeClass("hidden-preload");
  $(window).on("resize", setMockupsTop);

  setMockupsTop();

  /** PLUGINS INITIALIZATION */
  /* Bellow this, you can remove the plugins you're not going to use.
   * If you do so, remember to remove the script reference within the HTML.
   **/

  /**
   * Handle the login form, once the server has sent a successful response
   **/
  $(".login-form form").on("form.submitted", function(evt, data) {
    window.location.replace("admin/");
  });

  /**
   * Prettyprint
   **/
  window.prettyPrint && prettyPrint();

  /**
   * AOS
   * Cool scrolling animations
   **/
  AOS.init({
    offset: 100,
    duration: 1500,
    disable: "mobile"
  });

  /**
   * typed.js
   **/
  if ($(".typed").length) {
    var typed = new window.Typed(".typed", {
      strings: ["Invoicing", "Subscriptions", "Mailing", "Reporting"],
      typeSpeed: 150,
      backDelay: 500,
      backSpeed: 50,
      loop: true
    });
  }

  /**
   * COUNTERS
   **/
  if ($(".counter").length) {
    $(".counter").each(function(i, el) {
      new Waypoint({
        element: el,
        handler: function() {
          counterUp.default(el);
          this.destroy();
        },
        offset: "bottom-in-view"
      });
    });
  }

  /**
   * POPUPS
   **/
  (function() {
    $(".modal-popup").each(function() {
      var $element = $(this);

      // Some default to apply for all instances of Modal
      var defaults = {
        removalDelay: 500,
        preloader: false,
        midClick: true,
        callbacks: {
          beforeOpen: function() {
            this.st.mainClass = this.st.el.attr("data-effect");
          }
        }
      };

      // Defaults to use for specific types
      var typeDefaults = {
        image: {
          closeOnContentClick: true
        },
        gallery: {
          delegate: "a",
          // when gallery is used change the type to 'image'
          type: "image",
          tLoading: "Loading image #%curr%...",
          mainClass: "mfp-with-zoom mfp-img-mobile",
          gallery: {
            enabled: true,
            navigateByImgClick: true,
            preload: [0, 1] // Will preload 0 - before current, and 1 after the current image
          },
          image: {
            tError: '<a href="%url%">The image #%curr%</a> could not be loaded.'
          }
        }
      };

      // Load configuration values from data attributes
      var type = $element.data("type") || "inline";
      var zoomSpeed = $element.data("zoom") || false;
      var focus = $element.data("focus") || false;

      var attributes = {};

      if (zoomSpeed) {
        attributes.zoom = {
          enabled: true,
          duration: zoomSpeed
        };
      }

      if (focus) {
        attributes.focus = focus;
      }

      // According to the type, get the JSON configuration for each
      $.each(["image", "gallery"], function() {
        var attr = $element.data(this) || false;

        if (attr) {
          typeDefaults[type][this] = attr;
        }

        // remove the values from the markup
        $element.removeAttr("data-" + this);
      });

      var options = $.extend(
        {},
        defaults,
        {
          type: type
        },
        typeDefaults[type],
        attributes
      );

      $element.magnificPopup(options);
    });

    $(document).on("click", ".modal-popup-dismiss", function(e) {
      e.preventDefault();
      $.magnificPopup.close();
    });
  })();

  /**
   * ANIMATION BAR
   **/
  (function() {
    $(".whyus-progress-bars").animateBar({
      orientation: "horizontal",
      step: 100,
      duration: 1000,
      elements: [
        { label: "Implementation", value: 73, style: { progress: "progress-xs" } }, // style: { progress: "progress-4" }
        { label: "Design", value: 91, style: { progress: "progress-xs" } },
        { label: "Beauty", value: 97, style: { progress: "progress-xs" } },
        { label: "Branding", value: 61, style: { progress: "progress-xs" } },
        { label: "Responsiveness", value: 100, style: { progress: "progress-xs" } }
      ]
    });
  })();

  /**
   * Feather Icons
   **/
  feather.replace();

  /**
   * Prismjs
   **/

  /**
   * PRICING TABLES
   **/
  $(".pricing-table-basis").on("change", 'input[name="pricing-value"]', function() {
    console.log(this.value);
    var period = this.value;

    $(".odometer").each(function() {
      this.innerHTML = $(this).data(period + "-price");
    });
  });

  // TODO: isolate wizard stuff in a single file
  /** WIZARD
   * Each wizard has its own configuration, if you're going to use one or another please make sure the selector matches the one used bellow
   * You can remove the code you're not going to use to speed up the site.
   **/
  (function() {
    var defaultConfig = {
      showStepURLhash: false, // not show the hash on URL
      theme: "circles",
      anchorSettings: {
        removeDoneStepOnNavigateBack: true // remove the "done" on visited steps when navigating back
      }
    };

    // 1. BASIC WIZARD
    // This is a basic configuration, just setting the theme and default configuration
    $("#basic-wizard").smartWizard(defaultConfig);

    // 2. AJAX WIZARD
    // To load a step content from ajax just add "data-content-url" attribute to the step.
    $("#ajax-wizard").smartWizard(defaultConfig);

    // 3. FORM WIZARD
    // Another way to load content through ajax is set the "contentUrl" via setting
    // this will send all requests to the same endpoint, you can take control of it via "step_number" variable sent automatically

    // Save the wizard variable, we'll used it below to work with it
    var $formWizard = $("#form-wizard");
    var options = $.extend({}, defaultConfig, {
      contentURL: "wizard/get-form/",
      ajaxSettings: {
        type: "GET"
      }
    });
    var ajaxFormWizard = $formWizard.smartWizard(options);
    var doAjax = function($form, config) {
      var dfd = new $.Deferred();
      var settings = $.extend(true, {}, config, {
        url: $form.attr("action"),
        type: "POST",
        data: $form.serializeArray(),
        dataType: "json",
        beforeSend: function() {
          $formWizard.smartWizard("block");
        }
      });

      $.ajax(settings)
        .done(function(data) {
          if (data.result) {
            $form.trigger("form.submitted", [data]);

            $("input, textarea", $form).removeClass("error");
            $form.addClass("submitted");
          } else {
            if (data.errors) {
              $.each(data.errors, function(i, v) {
                var $input = $("[name$='[" + i + "]']", $form).addClass("error");
                $input
                  .tooltip({ title: v, placement: "bottom", trigger: "manual" })
                  .tooltip("show")
                  .on("focus", function() {
                    $(this).tooltip("destroy");
                  });
              });
            }
          }

          $formWizard.smartWizard("unblock");
          dfd.resolve(data.result);
        })
        .fail(function() {
          $formWizard.smartWizard("unblock");

          //show failure message
          dfd.reject();
        });

      return dfd.promise();
    };

    ajaxFormWizard
      .on("leaveStep", function(evt, anchorObject, stepNumber, stepDirection) {
        var $form = $("#form-step-" + stepNumber, $formWizard);

        // stepDirection === 'forward' :- this condition allows to do the form validation
        // only on forward navigation, that makes easy navigation on backwards still do the validation when going next
        if (stepDirection === "forward" && $form.length) {
          if (!$form.valid()) {
            return false;
          }

          return doAjax($form);
        }

        return true;
      })
      .on("showStep", function(evt, anchorObject, stepNumber, stepDirection) {
        var validateOptions = {
          errorPlacement: function(error, element) {
            var $parent = element.parent();

            if ($parent.hasClass("input-group")) {
              error.insertAfter($parent);
            } else if ($parent.hasClass("has-icon")) {
              error.insertBefore($parent);
            } else if ($parent.hasClass("control")) {
              error.insertAfter(element.next(".control-label"));
            } else {
              error.insertAfter(element);
            }
          }
        };

        var $form = $("#form-step-" + stepNumber, $formWizard);
        $form.validate(validateOptions);

        // some work with step-2 (pricing plans)
        if (stepNumber === 2) {
          $("input[type=radio]", $form).on("change", function(e) {
            $(e.target)
              .closest(".row")
              .find(".card")
              .removeClass("b b-3");

            $(e.target)
              .closest(".card")
              .addClass("b b-3");
          });
        }
      });
  })();
});

/*!
 * Dashcore - HTML Startup Template, v2.0.0
 * Horizontal random bubbles variations.
 * Copyright Â© 2019 5Studios.net
 * https://5studios.net
 * Credits to: https://codepen.io/lokesh
 */

("use strict");

(function($, global, $scope) {
  $scope.SCROLL_SPEED = 0.3;
  $scope.NOISE_SPEED = 0.004;
  $scope.NOISE_AMOUNT = 5;
  $scope.CANVAS_WIDTH = 2800;

  $scope.bubbles = [
    { s: 0.6, x: 1134, y: 45 },
    { s: 0.6, x: 1620, y: 271 },
    { s: 0.6, x: 1761, y: 372 },
    { s: 0.6, x: 2499, y: 79 },
    { s: 0.6, x: 2704, y: 334 },
    { s: 0.6, x: 2271, y: 356 },
    { s: 0.6, x: 795, y: 226 },
    { s: 0.6, x: 276, y: 256 },
    { s: 0.6, x: 1210, y: 365 },
    { s: 0.6, x: 444, y: 193 },
    { s: 0.6, x: 2545, y: 387 },
    { s: 0.8, x: 1303, y: 193 },
    { s: 0.8, x: 907, y: 88 },
    { s: 0.8, x: 633, y: 320 },
    { s: 0.8, x: 323, y: 60 },
    { s: 0.8, x: 129, y: 357 },
    { s: 0.8, x: 1440, y: 342 },
    { s: 0.8, x: 1929, y: 293 },
    { s: 0.8, x: 2135, y: 198 },
    { s: 0.8, x: 2276, y: 82 },
    { s: 0.8, x: 2654, y: 182 },
    { s: 0.8, x: 2783, y: 60 },
    { x: 1519, y: 118 },
    { x: 1071, y: 233 },
    { x: 1773, y: 148 },
    { x: 2098, y: 385 },
    { x: 2423, y: 244 },
    { x: 901, y: 385 },
    { x: 624, y: 111 },
    { x: 75, y: 103 },
    { x: 413, y: 367 },
    { x: 2895, y: 271 },
    { x: 1990, y: 75 }
  ];

  $scope.bubblesEl = document.querySelector(".bubbles-container");

  // For perlin noise
  $scope.noise = new window.Noise(Math.floor(Math.random() * 64000));

  function Bubbles(specs) {
    var instance = this;
    instance.bubbles = [];

    specs.forEach(function(spec, index) {
      instance.bubbles.push(new Bubble(index, spec.x, spec.y, spec.s));
    });

    requestAnimationFrame(instance.update.bind(instance));
  }

  function Bubble(index, x, y, s) {
    if (s === undefined) {
      s = 1;
    }

    this.index = index;
    this.x = x;
    this.y = y;
    this.scale = s;

    this.noiseSeedX = Math.floor(Math.random() * 64000);
    this.noiseSeedY = Math.floor(Math.random() * 64000);

    this.el = document.createElement("div");
    this.el.className = "bubble bubble-" + (this.index + 1);
    $scope.bubblesEl.appendChild(this.el);
  }

  Bubbles.prototype.update = function() {
    this.bubbles.forEach(function(bubble) {
      bubble.update();
    });
    this.raf = requestAnimationFrame(this.update.bind(this));
  };

  Bubble.prototype.update = function() {
    this.noiseSeedX += $scope.NOISE_SPEED;
    this.noiseSeedY += $scope.NOISE_SPEED;
    var randomX = $scope.noise.simplex2(this.noiseSeedX, 0);
    var randomY = $scope.noise.simplex2(this.noiseSeedY, 0);

    this.x -= $scope.SCROLL_SPEED;
    this.xWithNoise = this.x + randomX * $scope.NOISE_AMOUNT;
    this.yWithNoise = this.y + randomY * $scope.NOISE_AMOUNT;

    if (this.x < -200) {
      this.x = $scope.CANVAS_WIDTH;
    }

    this.el.style.transform =
      "translate(" + this.xWithNoise + "px, " + this.yWithNoise + "px) scale(" + this.scale + ")";
  };

  $(function() {
    if ($scope.bubblesEl) {
      new Bubbles($scope.bubbles);
    }
  });
})(jQuery, this, {});

/*!
 * Dashcore - HTML Startup Template, v1.1.8
 * Stripe menu.
 * Copyright Â© 2019 5Studios.net
 * https://5studios.net
 */

("use strict");

(function($, global, $scope) {
  $scope.Util = {
    queryArray: function(e, p) {
      p || (p = document.body);

      return Array.prototype.slice.call(p.querySelectorAll(e));
    },
    touch: {
      isSupported: "ontouchstart" in window || navigator.maxTouchPoints,
      isDragging: false
    }
  };

  function StripeMenu(menuElement) {
    var menu = this;

    /**
     * Main events used to enable interaction with menu
     **/
    var events = window.PointerEvent
      ? {
          end: "pointerup",
          enter: "pointerenter",
          leave: "pointerleave"
        }
      : {
          end: "touchend",
          enter: "mouseenter",
          leave: "mouseleave"
        };

    /**
     * The main navigation element.
     **/
    this.container = document.querySelector(menuElement);
    this.container.classList.add("no-dropdown-transition");

    /**
     * Element holding the menu options, not the dropdown
     **/
    this.root = this.container.querySelector(".st-nav-menu");

    /**
     * Those elements used to show the dropdown animation and transitioning
     **/
    this.dropdownBackground = this.container.querySelector(".st-dropdown-bg");
    this.dropdownBackgroundAlt = this.container.querySelector(".st-alt-bg");
    this.dropdownContainer = this.container.querySelector(".st-dropdown-container");
    this.dropdownArrow = this.container.querySelector(".st-dropdown-arrow");

    /**
     * Elements which will have the dropdown content to be shown
     **/
    this.hasDropdownLinks = $scope.Util.queryArray(".st-has-dropdown", this.root);

    /**
     * Each dropdown section to be displayed on mouse interactions
     **/
    this.dropdownSections = $scope.Util.queryArray(".st-dropdown-section", this.container).map(
      function(el) {
        return {
          el: el,
          name: el.getAttribute("data-dropdown"),
          content: el.querySelector(".st-dropdown-content"),
          width: el.querySelector(".st-dropdown-content").offsetWidth
        };
      }
    );

    /**
     * Menu link interaction
     **/
    this.hasDropdownLinks.forEach(function(el) {
      el.addEventListener(events.enter, function(evt) {
        if (evt.pointerType === "touch") return;
        menu.stopCloseTimeout();
        menu.openDropdown(el);
      });

      el.addEventListener(events.leave, function(evt) {
        if (evt.pointerType === "touch") return;
        menu.startCloseTimeout();
      });

      el.addEventListener(events.end, function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        menu.toggleDropdown(el);
      });
    });

    /**
     * Menu container interaction with content
     **/
    this.dropdownContainer.addEventListener(events.enter, function(evt) {
      if (evt.pointerType === "touch") return;
      menu.stopCloseTimeout();
    });

    this.dropdownContainer.addEventListener(events.leave, function(evt) {
      if (evt.pointerType === "touch") return;
      menu.startCloseTimeout();
    });

    this.dropdownContainer.addEventListener(events.end, function(evt) {
      evt.stopPropagation();
    });

    document.body.addEventListener(events.end, function(e) {
      $scope.Util.touch.isDragging || menu.closeDropdown();
    });
  }

  function StripeMenuPopup(element) {
    var popupMenu = this;
    var eventTrigger = $scope.Util.touch.isSupported ? "touchend" : "click";

    this.root = document.querySelector(element);
    this.activeClass = "st-popup-active";
    this.link = this.root.querySelector(".st-root-link");
    this.popup = this.root.querySelector(".st-popup");
    this.closeButton = this.root.querySelector(".st-popup-close-button");

    this.link.addEventListener(eventTrigger, function(evt) {
      evt.stopPropagation();
      popupMenu.togglePopup();
    });

    this.popup.addEventListener(eventTrigger, function(evt) {
      evt.stopPropagation();
    });

    this.closeButton &&
      this.closeButton.addEventListener(eventTrigger, function(evt) {
        popupMenu.closeAllPopups();
      });

    document.body.addEventListener(
      eventTrigger,
      function(evt) {
        $scope.Util.touch.isDragging || popupMenu.closeAllPopups();
      },
      false
    );
  }

  StripeMenu.prototype.openDropdown = function(hasDropDownLink) {
    var stripeMenu = this;
    if (this.activeDropdown === hasDropDownLink) return;

    this.activeDropdown = hasDropDownLink;

    this.container.classList.add("overlay-active");
    this.container.classList.add("dropdown-active");

    /**
     * Setting the default menu active equals to this link
     **/
    this.hasDropdownLinks.forEach(function(link) {
      link.classList.remove("active");
    });
    hasDropDownLink.classList.add("active");

    /**
     * Next section to show
     **/
    var nextSection = hasDropDownLink.getAttribute("data-dropdown"),
      position = "left";

    var dropdown = {
      width: 0,
      height: 0,
      content: null
    };

    this.dropdownSections.forEach(function(dropDownSection) {
      dropDownSection.el.classList.remove("active");
      dropDownSection.el.classList.remove("left");
      dropDownSection.el.classList.remove("right");

      if (dropDownSection.name === nextSection) {
        dropDownSection.el.classList.add("active");
        position = "right";

        dropdown = {
          width: dropDownSection.content.offsetWidth,
          height: dropDownSection.content.offsetHeight,
          content: dropDownSection.content
        };
      } else {
        dropDownSection.el.classList.add(position);
      }
    });

    var u = 520,
      a = 400,
      scaleX = dropdown.width / u,
      scaleY = dropdown.height / a,
      ddCr = hasDropDownLink.getBoundingClientRect(),
      translateX = ddCr.left + ddCr.width / 2 - dropdown.width / 2;

    translateX = Math.round(Math.max(translateX, 10));

    clearTimeout(this.disableTransitionTimeout);
    this.enableTransitionTimeout = setTimeout(function() {
      stripeMenu.container.classList.remove("no-dropdown-transition");
    }, 50);

    this.dropdownBackground.style.transform =
      "translateX(" + translateX + "px) scaleX(" + scaleX + ") scaleY(" + scaleY + ")";
    this.dropdownContainer.style.transform = "translateX(" + translateX + "px)";

    this.dropdownContainer.style.width = dropdown.width + "px";
    this.dropdownContainer.style.height = dropdown.height + "px";

    var arrowPosX = Math.round(ddCr.left + ddCr.width / 2);
    this.dropdownArrow.style.transform = "translateX(" + arrowPosX + "px) rotate(45deg)";

    var d = dropdown.content.children[0].offsetHeight / scaleY;
    this.dropdownBackgroundAlt.style.transform = "translateY(" + d + "px)";
  };

  StripeMenu.prototype.closeDropdown = function() {
    var stripeMenu = this;
    if (!this.activeDropdown) return;

    this.hasDropdownLinks.forEach(function(link, t) {
      link.classList.remove("active");
    });

    clearTimeout(this.enableTransitionTimeout);

    this.disableTransitionTimeout = setTimeout(function() {
      stripeMenu.container.classList.add("no-dropdown-transition");
    }, 50);

    this.container.classList.remove("overlay-active");
    this.container.classList.remove("dropdown-active");
    this.activeDropdown = undefined;
  };

  StripeMenu.prototype.toggleDropdown = function(e) {
    this.activeDropdown === e ? this.closeDropdown() : this.openDropdown(e);
  };

  StripeMenu.prototype.startCloseTimeout = function() {
    var e = this;
    e.closeDropdownTimeout = setTimeout(function() {
      e.closeDropdown();
    }, 50);
  };

  StripeMenu.prototype.stopCloseTimeout = function() {
    var e = this;
    clearTimeout(e.closeDropdownTimeout);
  };

  StripeMenuPopup.prototype.togglePopup = function() {
    var isActive = this.root.classList.contains(this.activeClass);

    this.closeAllPopups(true);
    isActive || this.root.classList.add(this.activeClass);
  };

  StripeMenuPopup.prototype.closeAllPopups = function(e) {
    var activeLinks = document.getElementsByClassName(this.activeClass);

    for (var i = 0; i < activeLinks.length; i++) activeLinks[i].classList.remove(this.activeClass);
  };

  $(function() {
    new StripeMenu(".st-nav");
    new StripeMenuPopup(".st-nav .st-nav-section.st-nav-mobile");
  });
})(jQuery, this, {});
