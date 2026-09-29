Kanboard.BoardTaskQuickActions = function(app) {
    this.app = app;
    this.holdDelay = 500;
    this.moveTolerance = 6;
    this.press = null;
    this.sheet = null;
    this.sheetTask = null;
};

Kanboard.BoardTaskQuickActions.prototype.execute = function() {
    if (this.app.hasId("board")) {
        this.listenToTouches();
    }
};

Kanboard.BoardTaskQuickActions.prototype.listen = function() {
    var self = this;

    $(document).on("keydown", function(e) {
        if (e.key === "Escape" && self.isSheetOpen()) {
            self.closeSheet();
        }
    });

    // The browser's own long press menu would pop up on top of the lift
    $(document).on("contextmenu", ".task-board", function(e) {
        if (self.app.isMobileLayout() && self.canLift(this)) {
            e.preventDefault();
        }
    });
};

// -- Press and hold --

Kanboard.BoardTaskQuickActions.prototype.listenToTouches = function() {
    var self = this;

    // Bound once on the document because the board is replaced on every refresh;
    // passive:false is required or Chrome ignores the preventDefault while dragging
    document.addEventListener("touchstart", function(e) { self.onTouchStart(e); }, {passive: false});
    document.addEventListener("touchmove", function(e) { self.onTouchMove(e); }, {passive: false});
    document.addEventListener("touchend", function(e) { self.onTouchEnd(e); }, {passive: false});
    document.addEventListener("touchcancel", function(e) { self.onTouchCancel(e); }, {passive: false});
};

Kanboard.BoardTaskQuickActions.prototype.onTouchStart = function(e) {
    var self = this;

    if (this.press && ! this.findTouch(e.changedTouches, this.press.touchId)) {
        // A palm or second finger must not abort the press, only the tracked touch drives it
        return;
    }

    if (e.touches.length > 1 || this.isSheetOpen() || ! this.app.isMobileLayout()) {
        this.cancelPress();
        return;
    }

    var card = $(e.target).closest(".task-board").get(0);

    if (! card) {
        return;
    }

    if (! this.canLift(card)) {
        return;
    }

    this.cancelPress();

    var touch = e.changedTouches[0];

    this.press = {
        card: card,
        target: e.target,
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startTouch: touch,
        draggable: $(card).hasClass("draggable-item"),
        lifted: false,
        moved: false,
        dragging: false,
        timer: setTimeout(function() {
            self.lift();
        }, this.holdDelay)
    };
};

Kanboard.BoardTaskQuickActions.prototype.onTouchMove = function(e) {
    var press = this.press;
    var touch = press ? this.findTouch(e.changedTouches, press.touchId) : null;

    if (! touch) {
        return;
    }

    var distance = Math.max(Math.abs(touch.clientX - press.startX), Math.abs(touch.clientY - press.startY));

    if (! press.lifted) {
        // Nothing is prevented before the lift, so the page scrolls and the board swipes as usual;
        // once the browser owns the scroll gesture the moves stop being cancelable, so let it have the touch
        if (! e.cancelable || distance > this.moveTolerance) {
            this.cancelPress();
        }
        return;
    }

    if (! e.cancelable) {
        // Same thing after the lift: the browser is already scrolling, so drop the press instead of fighting it
        this.cancelPress();
        return;
    }

    e.preventDefault();

    if (! press.draggable) {
        press.moved = press.moved || distance > this.moveTolerance;
        return;
    }

    if (! press.dragging) {
        // A finger held still still reports tiny moves, so wait for real travel before handing the touch to sortable
        if (distance <= this.moveTolerance) {
            return;
        }

        press.dragging = true;

        // Same trick as touch-punch, but aimed at the hidden cross because jQuery UI
        // only accepts a handle that sits inside the item, never the item itself
        this.simulateMouseEvent("mousedown", press.startTouch, $(press.card).find(".task-board-sort-handle").get(0) || press.target);
    }

    this.simulateMouseEvent("mousemove", touch, this.getMouseTarget(press));
};

Kanboard.BoardTaskQuickActions.prototype.onTouchEnd = function(e) {
    var press = this.press;
    var touch = press ? this.findTouch(e.changedTouches, press.touchId) : null;

    if (! touch) {
        return;
    }

    if (! press.lifted) {
        this.cancelPress();
        return;
    }

    // Otherwise the browser synthesises a click and the card navigates to the task
    e.preventDefault();

    if (press.dragging) {
        this.simulateMouseEvent("mouseup", touch, this.getMouseTarget(press));
        press.dragging = false;
    } else if (! press.moved) {
        this.openSheet(press.card);
    }

    this.cancelPress();
};

Kanboard.BoardTaskQuickActions.prototype.onTouchCancel = function(e) {
    var press = this.press;

    if (press && this.findTouch(e.changedTouches, press.touchId)) {
        this.cancelPress();
    }
};

Kanboard.BoardTaskQuickActions.prototype.canLift = function(card) {
    return $(card).hasClass("draggable-item") || $(card).find(".task-quick-action").length > 0;
};

Kanboard.BoardTaskQuickActions.prototype.isDragging = function() {
    return this.press !== null && this.press.dragging;
};

// jQuery UI listens on the document, so a target detached by a board refresh would swallow the mouseup
Kanboard.BoardTaskQuickActions.prototype.getMouseTarget = function(press) {
    return document.contains(press.target) ? press.target : document;
};

Kanboard.BoardTaskQuickActions.prototype.findTouch = function(touches, touchId) {
    for (var i = 0; i < touches.length; i++) {
        if (touches[i].identifier === touchId) {
            return touches[i];
        }
    }

    return null;
};

Kanboard.BoardTaskQuickActions.prototype.lift = function() {
    var press = this.press;

    if (! press) {
        return;
    }

    press.lifted = true;
    $(press.card).addClass("task-board-lifted");

    if (typeof navigator.vibrate === "function") {
        try {
            navigator.vibrate(30);
        } catch (err) {
            // Some browsers throw without a prior user gesture, nothing to do about it
        }
    }
};

Kanboard.BoardTaskQuickActions.prototype.cancelPress = function() {
    var press = this.press;

    if (! press) {
        return;
    }

    if (press.dragging && document.contains(press.card)) {
        // jQuery UI would otherwise wait forever for a mouseup, leaving the card floating and the placeholder in place
        this.app.get("BoardDragAndDrop").cancelDrag($(press.card).closest(".board-task-list"));
    }

    clearTimeout(press.timer);
    $(press.card).removeClass("task-board-lifted");
    this.press = null;
};

Kanboard.BoardTaskQuickActions.prototype.simulateMouseEvent = function(type, touch, target) {
    var event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
    });

    target.dispatchEvent(event);
};

// -- Quick action sheet --

Kanboard.BoardTaskQuickActions.prototype.getSheet = function() {
    var self = this;

    if (this.sheet) {
        return this.sheet;
    }

    var board = document.getElementById("board");
    var moveLabel = board.getAttribute("data-quick-actions-move-label") || "Move a task to another column";
    var cancelLabel = board.getAttribute("data-quick-actions-cancel-label") || "cancel";

    var sheet = $('<div class="task-quick-sheet" role="dialog" aria-modal="true">')
        .append('<div class="task-quick-sheet-backdrop">')
        .append($('<div class="task-quick-sheet-panel">')
            .append('<div class="task-quick-sheet-header"><strong class="task-quick-sheet-id"></strong> <span class="task-quick-sheet-title"></span></div>')
            .append($('<div class="task-quick-sheet-move">')
                .append($('<div class="task-quick-sheet-label">').text(moveLabel))
                .append('<ul class="task-quick-sheet-columns">'))
            .append('<ul class="task-quick-sheet-actions">')
            .append($('<button type="button" class="task-quick-sheet-cancel">').text(cancelLabel)));

    sheet.on("click", ".task-quick-sheet-backdrop, .task-quick-sheet-cancel", function(e) {
        e.preventDefault();
        self.closeSheet();
    });

    sheet.on("click", ".task-quick-sheet-columns a", function(e) {
        e.preventDefault();
        self.moveToColumn($(this).attr("data-column-id"));
    });

    // Only close here: the click keeps bubbling to the document where the modal and link handlers live
    sheet.on("click", ".task-quick-sheet-actions a", function() {
        self.closeSheet();
    });

    $("body").append(sheet);
    this.sheet = sheet;

    return sheet;
};

Kanboard.BoardTaskQuickActions.prototype.isSheetOpen = function() {
    return this.sheet !== null && this.sheet.hasClass("task-quick-sheet-open");
};

Kanboard.BoardTaskQuickActions.prototype.openSheet = function(card) {
    var sheet = this.getSheet();
    var task = {
        id: card.getAttribute("data-task-id"),
        columnId: card.getAttribute("data-column-id"),
        swimlaneId: card.getAttribute("data-swimlane-id")
    };

    var columns = sheet.find(".task-quick-sheet-columns").empty();
    var actions = sheet.find(".task-quick-sheet-actions").empty();

    if ($(card).hasClass("draggable-item")) {
        $.each(this.getColumns(), function(index, column) {
            if (column.id !== task.columnId) {
                columns.append($("<li>").append($('<a href="#">').attr("data-column-id", column.id).text(column.title)));
            }
        });
    }

    // Clones keep permissions, translations and plugin markup identical to the number menu
    $(card).find(".task-quick-action > a").each(function() {
        actions.append($("<li>").append($(this).clone()));
    });

    if (columns.children().length === 0 && actions.children().length === 0) {
        return;
    }

    sheet.find(".task-quick-sheet-move").toggle(columns.children().length > 0);
    sheet.find(".task-quick-sheet-id").text("#" + task.id);
    sheet.find(".task-quick-sheet-title").text(this.getTaskTitle(card));

    this.sheetTask = task;
    sheet.addClass("task-quick-sheet-open");
};

Kanboard.BoardTaskQuickActions.prototype.closeSheet = function() {
    if (this.sheet) {
        this.sheet.removeClass("task-quick-sheet-open");
    }

    this.sheetTask = null;
};

Kanboard.BoardTaskQuickActions.prototype.getTaskTitle = function(card) {
    var title = $(card).find(".task-board-title").text().trim();

    if (title === "") {
        title = $(card).find('a[href="' + card.getAttribute("data-task-url") + '"]').first().text().trim();
    }

    return title;
};

Kanboard.BoardTaskQuickActions.prototype.getColumns = function() {
    var columns = [];

    $(".board-column-nav-item[data-column-id]").each(function() {
        columns.push({id: this.getAttribute("data-column-id"), title: $(this).find(".board-column-nav-title").text().trim()});
    });

    if (columns.length === 0) {
        $("#board tr").first().find("th.board-column-header").each(function() {
            columns.push({id: this.getAttribute("data-column-id"), title: $(this).find(".board-column-title").text().trim()});
        });
    }

    return columns;
};

Kanboard.BoardTaskQuickActions.prototype.moveToColumn = function(columnId) {
    var task = this.sheetTask;
    var dragAndDrop = this.app.get("BoardDragAndDrop");

    this.closeSheet();

    if (! task) {
        return;
    }

    var position = $('.board-task-list[data-column-id="' + columnId + '"][data-swimlane-id="' + task.swimlaneId + '"] .task-board').length + 1;

    dragAndDrop.changeTaskState(task.id);
    dragAndDrop.save(task.id, task.columnId, columnId, position, task.swimlaneId);
};
