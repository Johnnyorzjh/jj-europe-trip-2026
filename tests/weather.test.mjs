import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { URL, Intl, Date, AbortController, setTimeout, clearTimeout };
const source = new URL('../original/weather.js', import.meta.url);
if (fs.existsSync(source)) vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox);
const W = sandbox.TripWeather || {};
function feature(name) { assert.equal(typeof W[name], 'function', `${name} must implement the weather feature`); return W[name]; }
const start = Date.parse('2026-09-27T10:00:00Z');
function fixture() {
  return {
    latitude:48.86, longitude:2.35, timezone:'Europe/Paris', utc_offset_seconds:7200,
    current_units:{temperature_2m:'°C',apparent_temperature:'°C',weather_code:'wmo code',is_day:''},
    current:{time:'2026-09-27T12:00',interval:900,temperature_2m:20,apparent_temperature:19,weather_code:3,is_day:1},
    daily_units:{temperature_2m_max:'°C',temperature_2m_min:'°C',precipitation_probability_max:'%',wind_speed_10m_max:'km/h',sunset:'iso8601'},
    daily:{time:['2026-09-27','2026-09-28'],weather_code:[3,61],temperature_2m_max:[23,21],temperature_2m_min:[14,13],precipitation_probability_max:[null,0],wind_speed_10m_max:[10,12],sunset:['2026-09-27T19:35','2026-09-28T19:33']}
  };
}
function storage() { const data = new Map(); return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; }
function setup(fetchImpl, options = {}) {
  let clock=start;
  const disk=options.storage || storage();
  const store=feature('createWeatherStore')({fetchImpl, storage:disk, now:()=>clock, ...options});
  return {store,disk,advance:ms=>{clock+=ms;}};
}
const ok = (body=fixture()) => ({ok:true,status:200,json:async()=>body});

test('destination dates use the city timezone across midnight', () => {
  const localDate=feature('localDate');
  assert.equal(localDate(Date.parse('2026-09-26T23:30:00Z'),'Europe/Paris'),'2026-09-27');
  assert.equal(localDate(Date.parse('2026-09-27T00:30:00+08:00'),'Europe/Paris'),'2026-09-26');
});
test('cross-city and Pisa trips have separate forecasts; Vatican uses Rome', () => {
  const cities=feature('dayCities');
  for(const [day,want] of [['2026-09-29',['paris','milan']],['2026-09-30',['milan','florence']],['2026-10-01',['pisa','florence']],['2026-10-02',['florence','rome']],['2026-10-05',['rome']],['2026-10-06',['rome','budapest']],['2026-10-08',['dubai','hongkong']]]) assert.deepEqual(Array.from(cities(day)),want);
  assert.deepEqual(Array.from(cities('2027-10-01')),[]);
});
test('suggested destination uses the trip calendar without GPS', () => {
  const recommended=feature('recommendedCity');
  assert.equal(recommended(Date.parse('2026-09-20T10:00:00Z')),'paris');
  assert.equal(recommended(Date.parse('2026-10-06T12:00:00Z')),'budapest');
  assert.equal(recommended(Date.parse('2026-10-09T12:00:00Z')),'hongkong');
});
test('overnight return flight shows Dubai only on the local arrival date', () => {
  assert.deepEqual(Array.from(feature('dayCities')('2026-10-07')), ['budapest']);
  assert.deepEqual(Array.from(feature('dayCities')('2026-10-08')), ['dubai', 'hongkong']);
});
test('unknown codes stay unknown instead of being shown as sunny', () => {
  const describe=feature('describeWeather');
  assert.equal(describe(61).label,'小雨');
  assert.equal(describe(0,0).icon,'moon');
  assert.equal(describe(null).icon,'unknown');
  assert.equal(describe(999).icon,'unknown');
});
test('request is keyless, local-time, metric, credential-free and coalesced', async () => {
  let calls=0; let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {store}=setup(async (url,options)=>{
    calls++; const u=new URL(url);
    assert.equal(u.origin,'https://api.open-meteo.com');
    assert.equal(u.searchParams.get('timezone'),'Europe/Paris');
    assert.equal(u.searchParams.get('forecast_days'),'16');
    assert.equal(u.searchParams.has('apikey'),false);
    assert.equal(options.credentials,'omit'); assert.equal(options.referrerPolicy,'no-referrer');
    await gate; return ok();
  });
  const first=store.get('paris'); const second=store.get('paris'); release();
  const [a,b]=await Promise.all([first,second]);
  assert.equal(calls,1); assert.equal(a.data.current.temperature,20); assert.equal(b.stale,false);
});
test('forecast matches the full date and distinguishes missing probability from zero', async()=>{
  const {store}=setup(async()=>ok()); const state=await store.get('paris');
  const select=feature('forecastState');
  const a=select(state.data,'2026-09-27','paris',start);
  const b=select(state.data,'2026-09-28','paris',start);
  assert.equal(a.kind,'forecast'); assert.equal(a.day.rainProbability,null);
  assert.equal(b.day.rainProbability,0); assert.equal(b.day.high,21);
  assert.equal(select(state.data,'2026-09-26','paris',start).kind,'past');
  assert.equal(select(state.data,'2026-10-20','paris',start).kind,'future');
  assert.equal(select(state.data,'2026-09-29','paris',start).kind,'missing');
});
test('valid cache survives reload and refreshes after thirty minutes', async()=>{
  let calls=0; const fetchImpl=async()=>{calls++;return ok();};
  const a=setup(fetchImpl); await a.store.get('paris');
  const b=setup(fetchImpl,{storage:a.disk}); await b.store.get('paris'); assert.equal(calls,1);
  b.advance(31*60000); await b.store.get('paris'); assert.equal(calls,2);
});
test('network failure preserves old data as stale and bounds repeated attempts', async()=>{
  let calls=0; let fail=false;
  const a=setup(async()=>{calls++;if(fail)throw new Error('offline');return ok();});
  await a.store.get('paris'); a.advance(31*60000); fail=true;
  const result=await a.store.get('paris');
  assert.equal(result.stale,true); assert.ok(result.error); assert.equal(result.data.current.temperature,20);
  await a.store.get('paris',{force:true}); assert.equal(calls,2);
});
test('cold failure resolves without crashing the itinerary', async()=>{
  const {store}=setup(async()=>({ok:false,status:429}));
  const result=await store.get('paris'); assert.equal(result.data,null); assert.ok(result.error);
});
test('malformed cache and disabled browser storage do not prevent live weather', async()=>{
  for(const disk of [{getItem:()=>'{broken',setItem:()=>{}},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('full');}}]){
    const {store}=setup(async()=>ok(),{storage:disk});
    assert.equal((await store.get('paris')).data.current.temperature,20);
  }
});
test('invalid provider timezone, units and dates are not presented as weather', async()=>{
  for(const mutate of [p=>{p.timezone='UTC';},p=>{p.current_units.temperature_2m='°F';},p=>{p.daily.time[0]='2026-02-31';},p=>{p.current.time='<img src=x>';},p=>{p.daily.time.push(p.daily.time[0]);}]){
    const payload=fixture(); mutate(payload);
    const {store}=setup(async()=>ok(payload)); const result=await store.get('paris');
    assert.equal(result.data,null); assert.ok(result.error);
  }
});
test('a hung request is aborted and returns an unavailable state', async()=>{
  const {store}=setup((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))),{timeoutMs:10});
  const result=await store.get('paris'); assert.equal(result.data,null); assert.ok(result.error);
});
