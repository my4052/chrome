import fs from 'fs';
import path from 'path';

import { Router } from 'express';
import puppeteer from 'puppeteer';

import {
  IBrowserHook,
  IPageHook,
  IBeforeHookRequest,
  IAfterHookResponse,
  ILaunchOptions,
  IInjectBlack,
} from './types.d';

const beforeHookPath = path.join(__dirname, '..', 'external', 'before.js');
const afterHookPath = path.join(__dirname, '..', 'external', 'after.js');
const browserSetupPath = path.join(__dirname, '..', 'external', 'browser.js');
const pageSetupPath = path.join(__dirname, '..', 'external', 'page.js');
const puppeteerSetupPath = path.join(
  __dirname,
  '..',
  'external',
  'puppeteer.js',
);
const externalRoutesPath = path.join(__dirname, '..', 'external', 'routes.js');

export const beforeRequest: (args: IBeforeHookRequest) => boolean =
  fs.existsSync(beforeHookPath) ? require(beforeHookPath) : () => true;

export const afterRequest: (args: IAfterHookResponse) => boolean =
  fs.existsSync(afterHookPath) ? require(afterHookPath) : () => true;

export const browserHook: (opts: IBrowserHook) => Promise<boolean> =
  fs.existsSync(browserSetupPath)
    ? require(browserSetupPath)
    : () => Promise.resolve(true);

export const pageHook: (opts: IPageHook) => Promise<boolean> = fs.existsSync(
  pageSetupPath,
)
  ? require(pageSetupPath)
  : () => Promise.resolve(true);

export const injectBlack = async (opts: IInjectBlack): Promise<void> => {
  const { page, driveMode, stealth } = opts;
  if (stealth) {
    return;
  }
  if (driveMode !== 'selenium') {
    return;
  }
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: function () {
        return [];
      },
    });

    function replaceWebGLVendor() {
      // 检查浏览器是否支持 WebGL。
      if (!window.WebGLRenderingContext) {
        console.log('WebGL is not supported.');
        return;
      }
      (window as any)._selenium = true;
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) {
        console.log('WebGL is supported but not enabled.');
        return;
      }
    
      const extensionDebugRendererInfo = gl.getExtension(
        'WEBGL_debug_renderer_info',
      );
      if (!extensionDebugRendererInfo) {
        console.log('WEBGL_debug_renderer_info extension is not supported.');
        return;
      }
    
      // 将 `UNMASKED_VENDOR_WEBGL` 参数值替换为 `'Intel Inc.'`。
    
      const ogGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === extensionDebugRendererInfo.UNMASKED_VENDOR_WEBGL) {
          return 'Google Inc.';
        }
        if (parameter === extensionDebugRendererInfo.UNMASKED_RENDERER_WEBGL) {
          return 'Mesa OffScreen';
        }
    
        return ogGetParameter.apply(this, [parameter]);
      };
    }

    // 调用替换函数 replaceWebGLVendor()
    replaceWebGLVendor();

    // Modernizr.hairline = false;
    const originalCreateElement = document.createElement;

    // 重写 createElement 方法，在创建 img 元素时自动设置宽和高属性
    document.createElement = function (tagName: string) {
      const elem = originalCreateElement.call(document, tagName);
      if (tagName === 'img') {
        elem.width = 0;
        elem.height = 0;
      }
      return elem;
    };
    // store the existing descriptor
    const elementDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    ) as any;

    // redefine the property with a patched descriptor
    Object.defineProperty(HTMLDivElement.prototype, 'offsetHeight', {
      ...elementDescriptor,
      get: function () {
        if (this.id === 'modernizr') {
          return 0;
        }
        return elementDescriptor.get.apply(this);
      },
    });
  });
};

export const externalRoutes: Router | null = fs.existsSync(externalRoutesPath)
  ? require(externalRoutesPath)
  : null;

export const puppeteerHook: (
  args: ILaunchOptions,
) => Promise<typeof puppeteer | null> = fs.existsSync(puppeteerSetupPath)
  ? require(puppeteerSetupPath)
  : () => Promise.resolve(null);
