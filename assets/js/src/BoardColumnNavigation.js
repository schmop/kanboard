Kanboard.BoardColumnNavigation = function(app) {
    this.app = app;
    this.currentColumnId = null;
    this.scrollTicking = false;
};

Kanboard.BoardColumnNavigation.prototype.execute = function() {
    if (this.app.hasId("board")) {
        this.render();
    }
};

Kanboard.BoardColumnNavigation.prototype.listen = function() {
    var self = this;

    $(document).on("click", ".board-column-nav-item", function(e) {
        e.preventDefault();
        self.goToColumn($(this).data("column-id"));
    });

    // Rotating a phone can switch the tabs on or off without a reload
    $(window).on("resize", function() {
        self.onScroll();
    });
};

Kanboard.BoardColumnNavigation.prototype.onBoardRendered = function() {
    this.render();
};

Kanboard.BoardColumnNavigation.prototype.render = function() {
    var self = this;

    // The whole board is replaced on refresh, so put the user back on the column they were looking at
    if (this.currentColumnId !== null) {
        this.scrollToColumn(this.currentColumnId, false);
    }

    // Bound even when the tabs are hidden: the wrapper only scrolls on narrow screens anyway
    $(".board-scroll").on("scroll", function() {
        self.onScroll();
    });

    this.highlight();
};

Kanboard.BoardColumnNavigation.prototype.onScroll = function() {
    var self = this;

    if (this.scrollTicking) {
        return;
    }

    this.scrollTicking = true;

    window.requestAnimationFrame(function() {
        self.scrollTicking = false;
        self.highlight();
    });
};

Kanboard.BoardColumnNavigation.prototype.getContainer = function() {
    return $(".board-scroll").get(0);
};

Kanboard.BoardColumnNavigation.prototype.getHeaders = function() {
    return $("#board tr").first().find("th.board-column-header");
};

Kanboard.BoardColumnNavigation.prototype.getColumnOffset = function(container, header) {
    return header.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
};

Kanboard.BoardColumnNavigation.prototype.getVisibleColumnId = function() {
    var self = this;
    var container = this.getContainer();
    var columnId = null;
    var closestDistance = Infinity;

    if (! container) {
        return null;
    }

    this.getHeaders().each(function() {
        var distance = Math.abs(self.getColumnOffset(container, this) - container.scrollLeft);

        if (distance < closestDistance) {
            closestDistance = distance;
            columnId = $(this).data("column-id");
        }
    });

    return columnId;
};

Kanboard.BoardColumnNavigation.prototype.highlight = function() {
    if (! this.app.isMobileLayout()) {
        return;
    }

    var columnId = this.getVisibleColumnId();

    if (columnId === null) {
        return;
    }

    this.currentColumnId = columnId;

    $(".board-column-nav-item").removeClass("board-column-nav-item-active");

    var tab = $(".board-column-nav-item[data-column-id=" + columnId + "]");
    tab.addClass("board-column-nav-item-active");
    this.revealTab(tab.get(0));
};

Kanboard.BoardColumnNavigation.prototype.revealTab = function(tab) {
    var nav = $(".board-column-nav").get(0);

    if (! nav || ! tab) {
        return;
    }

    var left = tab.offsetLeft;
    var right = left + tab.offsetWidth;

    if (left < nav.scrollLeft) {
        nav.scrollLeft = left;
    } else if (right > nav.scrollLeft + nav.clientWidth) {
        nav.scrollLeft = right - nav.clientWidth;
    }
};

Kanboard.BoardColumnNavigation.prototype.goToColumn = function(columnId) {
    if (localStorage.getItem("hidden_column_" + columnId)) {
        this.app.get("BoardColumnView").toggle(columnId);
    }

    this.currentColumnId = columnId;
    this.scrollToColumn(columnId, true);
};

Kanboard.BoardColumnNavigation.prototype.scrollToColumn = function(columnId, smooth) {
    var container = this.getContainer();
    var header = this.getHeaders().filter("[data-column-id=" + columnId + "]").get(0);

    if (! container || ! header) {
        return;
    }

    var left = this.getColumnOffset(container, header);

    if (smooth && typeof container.scrollTo === "function") {
        container.scrollTo({left: left, behavior: "smooth"});
    } else {
        container.scrollLeft = left;
    }
};
