// Verbatim logic from origin/main shell-control-correlation.html (pre-overhaul), used as a
// reference to prove the new tool reads the original export layout and writes an identical CSV.
'use strict';
  var HEADER_ROW_INDEX = 14;
  var DATA_START_INDEX = 15;
  function parseCSV(text){
    var rows = [], row = [], field = '', inQuotes = false, i = 0, len = text.length;
    while(i < len){
      var c = text.charAt(i);
      if(inQuotes){
        if(c === '"'){
          if(text.charAt(i+1) === '"'){ field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if(c === '"'){ inQuotes = true; i++; continue; }
      if(c === ','){ row.push(field); field = ''; i++; continue; }
      if(c === '\r'){ i++; continue; }
      if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if(field.length > 0 || row.length > 0){ row.push(field); rows.push(row); }
    return rows;
  }

  function pad2(n){ return String(n).padStart(2,'0'); }
  function parseDateTime(str){
    if(str === null || str === undefined) return null;
    var s = String(str).trim();
    if(!s) return null;
    var d = new Date(s);
    if(!isNaN(d.getTime())) return d;
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(m){
      var mm = parseInt(m[1],10)-1;
      var dd = parseInt(m[2],10);
      var yyyy = parseInt(m[3].length===2 ? '20'+m[3] : m[3], 10);
      var HH = m[4] ? parseInt(m[4],10) : 0;
      var MM = m[5] ? parseInt(m[5],10) : 0;
      var SS = m[6] ? parseInt(m[6],10) : 0;
      var dt = new Date(yyyy,mm,dd,HH,MM,SS);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }
  function dateToDay(d){ return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); }
  function dayToDate(d){ return new Date(d*86400000); }
  function formatDate(d){ return pad2(d.getUTCMonth()+1)+'/'+pad2(d.getUTCDate())+'/'+d.getUTCFullYear(); }
  function formatDateTime(d){ return pad2(d.getMonth()+1)+'/'+pad2(d.getDate())+'/'+d.getFullYear()+' '+pad2(d.getHours())+':'+pad2(d.getMinutes()); }
  function calculateCst(sec, type){
    if(!sec || sec<=0) return null;
    switch(type){
      case "EZ-Zahn4": return 13.26*sec - (673/sec);
      case "EZ-Zahn5": return 23.56*sec - (744/sec);
      case "ISO6":     return 6.9*sec  - (570/sec);
      case "ISO8":     return 21.78*sec - (306/sec);
    }
    return null;
  }
  function isValidSensor(v){ return isFinite(v) && v>0 && v!==-999 && Math.abs(v)<1e10; }
  function getInterpolatedSensor(arr,i){
    var c = arr[i];
    if(isValidSensor(c)) return {value:c, interpolated:false};
    var b = null, f = null;
    for(var j=i-1; j>=0; j--) if(isValidSensor(arr[j])){ b = arr[j]; break; }
    for(var k=i+1; k<arr.length; k++) if(isValidSensor(arr[k])){ f = arr[k]; break; }
    if(b!==null && f!==null) return {value:(b+f)/2, interpolated:true};
    if(b!==null) return {value:b, interpolated:true};
    if(f!==null) return {value:f, interpolated:true};
    return {value:null, interpolated:false};
  }
function autoDetect(headersList){
  var o={date:'',manual:'',sensor:''};
  for(var i=0;i<headersList.length;i++){
    var hl=String(headersList[i]||'').toLowerCase();
    if(hl.indexOf('date')!==-1||hl.indexOf('time')!==-1){ if(o.date==='') o.date=String(i); }
    if(hl.indexOf('zahn')!==-1||hl.indexOf('efflux')!==-1||hl.indexOf('cup')!==-1||hl.indexOf('sec')!==-1){ if(o.manual==='') o.manual=String(i); }
    if(hl.indexOf('viscosity')!==-1||(hl.indexOf('cp')!==-1&&hl.indexOf('cup')===-1)){ if(o.sensor==='') o.sensor=String(i); }
  }
  return o;
}
// handleFileUpload + processData + downloadCSV (no shifts), condensed from origin/main
function run(text, cupType){
  var parsed=parseCSV(text), headerRow=parsed[HEADER_ROW_INDEX];
  var headers=headerRow.map(function(h){return String(h==null?'':h).trim();});
  var raw=[]; for(var j=DATA_START_INDEX;j<parsed.length;j++){var row=parsed[j]; if(!row)continue; var has=false; for(var k=0;k<row.length;k++) if(String(row[k]||'').trim().length>0){has=true;break;} if(has) raw.push(row);}
  var det=autoDetect(headers), m=+det.manual, s=+det.sensor, dCol=+det.date;
  var sensorArr=raw.map(function(r){return parseFloat(r[s]);}), out=[];
  for(var r=0;r<raw.length;r++){var rr=raw[r]; var cs=parseFloat(rr[m]); if(!isFinite(cs)||cs<=0) continue; var dt=parseDateTime(rr[dCol]); if(!dt) continue;
    var ip=getInterpolatedSensor(sensorArr,r); if(ip.value===null) continue; var cc=calculateCst(cs,cupType); if(cc===null||!isFinite(cc)) continue;
    out.push({date:dt,cupSec:cs,sensorCP:ip.value,calcCst:cc,absDiff:Math.abs(cc-ip.value),interpolated:ip.interpolated});}
  var c='DateTime,CupSec,CalcCst,SensorCP,AbsDiff,Interpolated\n';
  out.forEach(function(p){ c+=formatDateTime(p.date)+','+p.cupSec.toFixed(3)+','+p.calcCst.toFixed(3)+','+p.sensorCP.toFixed(3)+','+p.absDiff.toFixed(3)+','+(p.interpolated?'Yes':'No')+'\n'; });
  return { headers: headers, rows: raw, detected: det, csv: c, n: out.length };
}
module.exports = { run: run, HEADER_ROW_INDEX: HEADER_ROW_INDEX, DATA_START_INDEX: DATA_START_INDEX };
