const a = require('C:/Users/Administrator/AppData/Local/Temp/codex-wx-debug/node_modules/miniprogram-automator');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const out = path.join(require('os').tmpdir(),'codex-content-v2-verify');
fs.mkdirSync(out,{recursive:true});
async function main() {
  const m = await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});
  const previous = await m.evaluate(()=>({eit:wx.getStorageSync('eit_read_v2'),method:wx.getStorageSync('method_read_v2')}));
  try {
    for(const [key,count] of [['eit',18],['method',16]]) {
      const p=await m.reLaunch(`/pages/${key}/${key}`);
      await p.waitFor(1800);
      assert.equal(await p.data('total'),count);
      assert.equal((await p.data('groups')).length,4);
      assert.equal((await p.$$('.lesson-card')).length,count);
      await m.screenshot({path:path.join(out,key+'-list.png')});
      await (await p.$('.lesson-card')).tap();
      await p.waitFor(600);
      const detail=await m.currentPage();
      await ready(detail,0);
      assert.equal(await detail.data('currentIndex'),0);
      await m.screenshot({path:path.join(out,key+'-first.png')});
      const scroll=await detail.$('.lesson-scroll');
      await scroll.scrollTo(0,530);
      await detail.waitFor(800);
      await m.screenshot({path:path.join(out,key+'-text.png')});
      const next=(await detail.$$('.nav-button'))[1];
      await next.tap();
      await detail.waitFor(500);
      assert.equal(await detail.data('currentIndex'),1);
      const swiper=await detail.$('.lesson-swiper');
      await swiper.swipeTo(count-1);
      await ready(detail,count-1);
      assert.equal(await detail.data('currentIndex'),count-1);
      await m.screenshot({path:path.join(out,key+'-last.png')});
      // Check all uploaded illustrations through the actual native image load event.
      for(let i=0;i<count;i++) {
        await swiper.swipeTo(i);
        await ready(detail,i);
      }
      console.log('PASS '+key+': '+count+' native images loaded, grouped list, tap, swipe, navigation and body scrolling');
    }
    console.log('Screenshots: '+out);
  } finally {
    await m.evaluate(old=>{
      for(const key of ['eit','method']) {
        if(old[key])wx.setStorageSync(key+'_read_v2',old[key]);
        else wx.removeStorageSync(key+'_read_v2');
      }
    },previous);
    await m.reLaunch('/pages/eit/eit');
    m.disconnect();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
async function ready(page,index) {
  const deadline=Date.now()+20000;
  while(Date.now()<deadline) {
    if(await page.data(`cards[${index}].imageStatus`)==='ready') return;
    await page.waitFor(300);
  }
  throw new Error('Image not ready: '+page.path+' #'+index);
}
