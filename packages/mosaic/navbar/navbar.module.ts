import { A11yModule } from '@angular/cdk/a11y';
import { PlatformModule } from '@angular/cdk/platform';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { McIconModule } from '@ptsecurity/mosaic/icon';

import {
    McNavbar,
    McNavbarContainer,
    McNavbarItem,
    McNavbarTitle,
    McNavbarBrand,
    McNavbarLogo,
    McNavbarToggle
} from './navbar.component';


@NgModule({
    imports: [
        CommonModule,
        A11yModule,
        PlatformModule,
        McIconModule
    ],
    exports: [
        McNavbar,
        McNavbarContainer,
        McNavbarTitle,
        McNavbarItem,
        McNavbarBrand,
        McNavbarLogo,
        McNavbarToggle
    ],
    declarations: [
        McNavbar,
        McNavbarContainer,
        McNavbarTitle,
        McNavbarItem,
        McNavbarBrand,
        McNavbarLogo,
        McNavbarToggle
    ]
})
export class McNavbarModule {}
