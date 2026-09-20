import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox={URL,Intl,Date,AbortController,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(new URL('../original/weather.js',import.meta.url),'utf8'),sandbox);
const ui=new URL('../original/weather-ui.js',import.meta.url);
if(fs.existsSync(ui))vm.runInNewContext(fs.readFileSync(ui,'utf8'),sandbox);
const view=sandbox.TripWeatherView || {};
const now=Date.parse('2026-09-27T10:00:00Z');
function feature(name){assert.equal(typeof view[name],'function',name+' must render weather');return view[name];}
const state={
  fetchedAt:now,stale:false,error:null,
  data:{current:{time:'2026-09-27T12:00',temperature:20,apparent:19,code:3,isDay:1},
    days:[{date:'2026-09-27',high:23,low:14,rainProbability:null,wind:10,sunset:'2026-09-27T19:35',code:3}]}
};
test('daily weather provides a compact city, condition, range and rain summary',()=>{
  const html=feature('forecastMarkup')('2026-09-27','paris',state,now);
  for(const text of ['巴黎','阴','14–23°C','降雨 —'])assert.ok(html.includes(text),text);
  for(const detail of ['体感','最大风速','日落'])assert.ok(!html.includes(detail),detail+' is not part of the compact summary');
});
test('null rain probability is rendered as missing, not as zero',()=>{
  const render=feature('forecastMarkup');
  const html=render('2026-09-27','paris',state,now);
  assert.ok(html.includes('降雨 —')); assert.ok(!html.includes('0%'));
  const zero=structuredClone(state);zero.data.days[0].rainProbability=0;
  assert.ok(render('2026-09-27','paris',zero,now).includes('降雨 0%'));
});
test('pending and past dates do not borrow another date forecast',()=>{
  const render=feature('forecastMarkup');
  const pending=render('2026-10-20','paris',state,now);
  assert.ok(pending.includes('尚未进入预报范围'));assert.ok(!pending.includes('23°'));
  assert.ok(render('2026-09-26','paris',state,now).includes('行程日期已过'));
});
test('stale cache is visibly identified when refresh fails',()=>{
  const stale={...state,stale:true,error:'offline'};
  assert.ok(feature('forecastMarkup')('2026-09-27','paris',stale,now).includes('缓存'));
});
test('weather failure produces a usable fallback, not a loading state forever',()=>{
  const html=feature('forecastMarkup')('2026-09-27','paris',{data:null,stale:false,fetchedAt:null,error:'offline'},now);
  assert.ok(html.includes('天气暂时无法更新'));assert.ok(!html.includes('正在加载'));
});
test('both deployment trees contain identical weather and itinerary assets',()=>{
  for(const [source,target] of [['index.html','trip.html'],['weather.js','weather.js'],['weather-ui.js','weather-ui.js'],['weather.css','weather.css']]){
    const a=new URL('../original/'+source,import.meta.url),b=new URL('../public/'+target,import.meta.url);
    assert.ok(fs.existsSync(a)&&fs.existsSync(b),source+' must be present in both sites');
    assert.equal(fs.readFileSync(a,'utf8'),fs.readFileSync(b,'utf8'));
  }
});
