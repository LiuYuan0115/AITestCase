import { goToSolvely } from '~/utils';
import EVENT from '~/utils/event';
import type { Tabs } from 'webextension-polyfill';
import { isEmpty } from 'lodash-es';
import { type Subscriptions, } from '~/types';

const notifySolvelyToSolve = (tabId: number, imageBase64: string) => {
    // 页面加载完成后再发送消息
    browser.tabs.sendMessage(tabId, {
        type: EVENT.SOLVELY_BEGIN_SOLVE_QUESTION, 
        imageBase64 
    });
}

export const gotoSolvelyToSolveQuestion = async (imageBase64: string) => {
    // 等待页面跳转完成
    let tab = await goToSolvely('/home');
    if(!tab) {
       const tabs = await browser.tabs.query({ active: true, currentWindow: true });
       tab = tabs[0] as Tabs.Tab;
    }
    if (tab?.id) {
        // 等待页面加载完成，经过实验，这个方案是等待页面加载完成最好的方案
        // 其他方案要么消息都发不出来，要么就是早于页面加载完成发出消息
        await new Promise<void>((resolve) => {
            const checkComplete = () => {
                browser.tabs.get(tab.id!).then((currentTab) => {
                    if (currentTab.status === 'complete') {
                        // 页面加载完成
                        resolve();
                    } else {
                        // 每100ms检查一次页面加载状态，直到页面加载完成
                        setTimeout(checkComplete, 100);
                    }
                });
            };
            checkComplete();
        });
        notifySolvelyToSolve(tab.id, imageBase64);
    }
    return 'done';
}   

export const gotoSolvelyToSolveQuestionWithoutLogin = async(imageBase64: string) => {
    let tab = await goToSolvely('/home?log');
    if(!tab?.id) return;
    if(!imageBase64) return;
    browser.storage.local.set({
        tabId: tab.id,
        imageBase64
    });
}

export const checkIfHasRejectImage = async (subscriptions?: Subscriptions) => {
    // 如果没有订阅信息，说明是登出事件
    const IMAGE_TAB_KEYS = ['tabId', 'imageBase64'];
    try {
        if(!subscriptions) return;
        const result = await browser.storage.local.get(IMAGE_TAB_KEYS);
        if(isEmpty(result)) return;
        const [ atciveTab ] = await browser.tabs.query({ active: true, currentWindow: true });
        if(atciveTab?.id !== result.tabId) return;
        // 广播开始解题消息
        notifySolvelyToSolve(result.tabId, result.imageBase64);
    } catch (error) {
        console.log('checkIfhasRejectImage:', error);
    } finally {
        // 只要有登录/登出事件，就删除本地缓存
        browser.storage.local.remove(IMAGE_TAB_KEYS);
    }
}