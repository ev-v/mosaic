import { FocusMonitor } from '@angular/cdk/a11y';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
    AfterViewInit,
    Attribute,
    Component,
    Directive,
    ElementRef,
    Input,
    OnDestroy,
    OnInit,
    QueryList,
    ViewChildren,
    ViewEncapsulation
} from '@angular/core';
import { CanDisable, CanDisableCtor, HasTabIndexCtor, mixinDisabled, mixinTabIndex } from '@ptsecurity/mosaic/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';


const COLLAPSED_CLASS: string = 'mc-navbar-collapsed-title';

export type McNavbarContainerPositionType = 'left' | 'right';


@Directive({
    selector: 'mc-navbar-logo',
    host: {
        class: 'mc-navbar-logo'
    }
})
export class McNavbarLogo {}


@Directive({
    selector: 'mc-navbar-title',
    host: {
        class: 'mc-navbar-title'
    }
})
export class McNavbarTitle {}


@Directive({
    selector: 'mc-navbar-brand',
    host: {
        class: 'mc-navbar-brand',
        '[class.mc-navbar-brand_vertical]': 'mcNavbar.vertical',
        '[class.mc-navbar-brand_closed]': 'mcNavbar.closed'
    }
})
export class McNavbarBrand {
    constructor(public mcNavbar: McNavbar) {}
}


export class McNavbarItemBase {
    constructor(public elementRef: ElementRef) {}
}

// tslint:disable-next-line:naming-convention
export const McNavbarMixinBase:
    HasTabIndexCtor & CanDisableCtor & typeof McNavbarItemBase = mixinTabIndex(mixinDisabled(McNavbarItemBase));


@Component({
    selector: 'mc-navbar-item',
    template: `<ng-content></ng-content>`,
    encapsulation: ViewEncapsulation.None,
    inputs: ['disabled', 'tabIndex'],
    host: {
        class: 'mc-navbar-item',
        '[class.mc-navbar-item_vertical]': 'mcNavbar.vertical',
        '[class.mc-navbar-item_closed]': 'mcNavbar.closed',
        '[attr.tabindex]': 'tabIndex',
        '[attr.disabled]': 'disabled || null'
    }
})
export class McNavbarItem extends McNavbarMixinBase implements OnInit, OnDestroy, CanDisable {
    @Input()
    set collapsedTitle(value: string) {
        this.elementRef.nativeElement.setAttribute('computedTitle', encodeURI(value));
    }

    constructor(
        public  elementRef: ElementRef,
        private _focusMonitor: FocusMonitor,
        public mcNavbar: McNavbar
    ) {
        super(elementRef);
    }

    ngOnInit() {
        this.denyClickIfDisabled();

        this._focusMonitor.monitor(this.elementRef.nativeElement, true);
    }

    ngOnDestroy() {
        this._focusMonitor.stopMonitoring(this.elementRef.nativeElement);
    }

    // This method is required due to angular 2 issue https://github.com/angular/angular/issues/11200
    private denyClickIfDisabled() {
        const events: Event[] = this.elementRef.nativeElement.eventListeners('click');

        events.forEach((event) => this.elementRef.nativeElement.removeEventListener('click', event));

        this.elementRef.nativeElement.addEventListener(
            'click',
            (event: MouseEvent) => {
                if (this.elementRef.nativeElement.hasAttribute('disabled')) {
                    event.stopImmediatePropagation();
                }
            },
            true
        );

        events.forEach((event) => this.elementRef.nativeElement.addEventListener('click', event));
    }
}


@Directive({
    selector: 'mc-navbar-container',
    host: {
        class: 'mc-navbar-container',
        '[class.mc-navbar-left]': 'this.position === "left"',
        '[class.mc-navbar-right]': 'this.position == "right"',
        '[class.mc-navbar_top]': 'this.position == "top"',
        '[class.mc-navbar_bottom]': 'this.position == "bottom"'
    }
})
export class McNavbarContainer {
    @Input() position: McNavbarContainerPositionType;
}

class CollapsibleItem {
    private collapsed: boolean = false;

    constructor(public element: HTMLElement, public width: number) {}

    processCollapsed(collapsed: boolean) {
        this.collapsed = collapsed;

        this.updateCollapsedClass();
    }

    private updateCollapsedClass() {
        if (this.collapsed) {
            this.element.classList.add(COLLAPSED_CLASS);
        } else {
            this.element.classList.remove(COLLAPSED_CLASS);
        }
    }
}

class CachedItemWidth {
    get canCollapse(): boolean {
        return this.itemsForCollapse.length > 0;
    }

    get collapsedItemsWidth(): number {
        if (this._collapsedItemsWidth !== undefined) {
            return this._collapsedItemsWidth;
        }

        this.calculateAndCacheCollapsedItemsWidth();

        return this._collapsedItemsWidth;
    }

    private _collapsedItemsWidth: number;

    constructor(
        public element: HTMLElement,
        public width: number,
        public itemsForCollapse: CollapsibleItem[] = []
    ) {}

    processCollapsed(collapsed: boolean) {
        if (this.itemsForCollapse.length > 0) {
            this.updateTitle(collapsed);
        }

        this.itemsForCollapse.forEach((item) => item.processCollapsed(collapsed));
    }

    private calculateAndCacheCollapsedItemsWidth() {
        this._collapsedItemsWidth = this.itemsForCollapse
            .reduce((acc, item) => acc + item.width, 0);
    }

    private getTitle(): string {
        const computedTitle = this.element.getAttribute('computedTitle');

        return computedTitle
            ? decodeURI(computedTitle)
            : (this.itemsForCollapse.length > 0 ? this.itemsForCollapse[0].element.innerText : '');
    }

    private updateTitle(collapsed: boolean) {
        if (collapsed) {
            this.element.setAttribute('title', this.getTitle());
        } else {
            this.element.removeAttribute('title');
        }
    }
}


@Component({
    selector: 'mc-navbar',
    template: `
        <nav class="mc-navbar"
             [class.mc-navbar_vertical]="vertical"
             [class.mc-navbar_horizontal]="!vertical"
             [class.mc-navbar_closed]="closed"
             [class.mc-navbar_opened]="!closed">

            <ng-content select="[mc-navbar-container], mc-navbar-container"></ng-content>
            <ng-content select="[mc-navbar-toggle], mc-navbar-toggle"></ng-content>
        </nav>
    `,
    styleUrls: ['./navbar.scss'],
    encapsulation: ViewEncapsulation.None
})
export class McNavbar implements AfterViewInit, OnDestroy {

    readonly vertical: boolean = false;
    closed: boolean = true;

    @ViewChildren(McNavbarItem) navbarItems: QueryList<McNavbarItem>;

    private readonly forceRecalculateItemsWidth: boolean = false;
    private readonly resizeDebounceInterval: number = 100;
    private readonly firstLevelElement: string = 'mc-navbar-container';
    private readonly secondLevelElements: string[] = [
        'mc-navbar-item',
        'mc-navbar-brand',
        'mc-navbar-title'
    ];

    private totalItemsWidths: number;

    private get maxAllowedWidth(): number {
        return this.elementRef.nativeElement.querySelector('nav').getBoundingClientRect().width;
    }

    private get itemsWidths(): CachedItemWidth[] {
        if (this._itemsWidths !== undefined && !this.forceRecalculateItemsWidth) {
            return this._itemsWidths;
        }

        this.calculateAndCacheItemsWidth();

        return this._itemsWidths;
    }

    private _itemsWidths: CachedItemWidth[];

    private get totalItemsWidth(): number {
        if (this.totalItemsWidths !== undefined && !this.forceRecalculateItemsWidth) {
            return this.totalItemsWidths;
        }

        this.calculateAndCacheTotalItemsWidth();

        return this.totalItemsWidths;
    }

    private resizeSubscription: Subscription;

    constructor(
        private elementRef: ElementRef,
        @Attribute('vertical') vertical: string
    ) {
        this.vertical = coerceBooleanProperty(vertical);

        const resizeObserver = fromEvent(window, 'resize')
            .pipe(debounceTime(this.resizeDebounceInterval));

        this.resizeSubscription = resizeObserver.subscribe(this.updateCollapsed.bind(this));
    }

    updateCollapsed(): void {
        let collapseDelta = this.totalItemsWidth - this.maxAllowedWidth;

        for (let i = this.itemsWidths.length - 1; i >= 0; i--) {
            const item = this.itemsWidths[i];

            if (!item.canCollapse) { continue; }

            item.processCollapsed(collapseDelta > 0);
            collapseDelta -= item.collapsedItemsWidth;
        }
    }

    ngAfterViewInit(): void {
        // Note: this wait is required for loading and rendering fonts for icons;
        // unfortunately we cannot control font rendering
        setTimeout(() => this.updateCollapsed(), 0);
    }

    ngOnDestroy() {
        this.resizeSubscription.unsubscribe();
    }

    toggle(): void {
        this.closed = !this.closed;
    }

    private calculateAndCacheTotalItemsWidth() {
        this.totalItemsWidths = this.itemsWidths
            .reduce((acc, item) => acc + item.width, 0);
    }

    private getOuterElementWidth(element: HTMLElement): number {
        const baseWidth  = element.getBoundingClientRect().width;
        const marginRight = parseInt(getComputedStyle(element).getPropertyValue('margin-right'));
        const marginLeft = parseInt(getComputedStyle(element).getPropertyValue('margin-left'));

        return baseWidth + marginRight + marginLeft;
    }

    private calculateAndCacheItemsWidth() {
        const allItemsSelector = this.secondLevelElements
            .map((e: string) => `${this.firstLevelElement}>${e}`);

        const allItems: HTMLElement[] = Array.from(this.elementRef.nativeElement.querySelectorAll(allItemsSelector));

        this._itemsWidths = allItems
            .map((el) => new CachedItemWidth(el, this.getOuterElementWidth(el), this.getItemsForCollapse(el)));
    }

    private getItemsForCollapse(element: HTMLElement): CollapsibleItem[] {
        const icon = element.querySelector(`[mc-icon],mc-navbar-logo,[mc-navbar-logo]`);

        if (!icon) { return []; }

        return Array.from(element.querySelectorAll('mc-navbar-title'))
            .map((el) => new CollapsibleItem(<HTMLElement> el, el.getBoundingClientRect().width));
    }
}


@Component({
    selector: 'mc-navbar-toggle',
    template: `
        <i class="mc mc-angle-right-M_16"></i>
        <ng-content></ng-content>
    `,
    host: {
        class: 'mc-navbar-toggle mc-navbar-item',
        '(click)': 'clickHandler()'
    },
    styleUrls: ['./navbar.scss'],
    encapsulation: ViewEncapsulation.None
})
export class McNavbarToggle {
    constructor(private mcNavbar: McNavbar) {}

    clickHandler() {
        this.mcNavbar.toggle();
    }
}
