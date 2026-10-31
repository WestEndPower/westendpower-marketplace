(() => {
  'use strict';

  const DATA = {
    products: [],
    batteries: [],
    chargers: [],
    compatibility: [],
    financePrograms: [],
    batterySystems: new Set(),
    settings: {},
    locations: [],
    inventoryByBrand: new Map(),
    financeSummaryCache: new Map(),
    financeSummaryPending: new Map(),
    equipmentFamilies: [],
    batteryFamilies: [],
    chargerFamilies: [],
    families: [],
    filtered: []
  };

  const state = {
    shopMode: 'equipment',
    category: '',
    subcategory: '',
    power: '',
    seriesOrEngine: '',
    width: '',
    brand: new Set(),
    availability: new Set(),
    buyOnline: false,
    promoOnly: false,
    promoView: 'current',
    search: '',
    specFilters: new Map(),
    seriesModelOpen: false,
    seriesModelView: '',
    seriesFilter: '',
    modelFilter: '',
    hpRanges: new Map(),
    packageFilter: '',
    packageComponents: new Set(),
    openBFilter: '',
    compare: new Set()
  };

  let applyingUrlState=false;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clean = v => String(v == null ? '' : v).trim();
  const truthy = v => /^(T|TRUE|Y|YES|1)$/i.test(clean(v));
  const num = v => {
    const n = Number(clean(v).replace(/[$,%]/g,''));
    return Number.isFinite(n) ? n : 0;
  };
  const moneyFormatter = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
  const money = v => moneyFormatter.format(Number(v||0));
  const esc = v => clean(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MARKETPLACE_API='https://westendpower-configurator-api.westendpower-nm.workers.dev';
  const skuKey = v => clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');

  const {bestMarketplaceFinanceProgram}=window.WestEndPayments;

  function parseCsv(text){
    text = String(text||'').replace(/^\uFEFF/,'');
    const rows=[]; let row=[], field='', q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(q){
        if(c==='"' && n==='"'){ field+='"'; i++; }
        else if(c==='"'){ q=false; }
        else field+=c;
      }else{
        if(c==='"') q=true;
        else if(c===','){ row.push(field); field=''; }
        else if(c==='\n'){ row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
        else field+=c;
      }
    }
    if(field.length || row.length){ row.push(field.replace(/\r$/,'')); rows.push(row); }
    if(!rows.length) return [];
    const headers=rows.shift().map(clean);
    return rows.filter(r=>r.some(x=>clean(x)!=='')).map(r=>{
      const o={}; headers.forEach((h,i)=>{ if(h) o[h]=r[i] ?? ''; }); return o;
    });
  }

  async function csv(path){
    const r=await fetch(path,{cache:'no-cache'});
    if(!r.ok) throw new Error(path+' '+r.status);
    return parseCsv(await r.text());
  }



function powerRank(v){const types=['manual','electric','battery','gas','diesel','hybrid','kerosene','natural gas','propane','tow-behind'];const rank=types.indexOf(String(v??'').trim().toLowerCase());return rank<0?types.length:rank}
function sortOrderValue(v){const s=String(v??'').trim(),n=Number(s);return s!==''&&Number.isFinite(n)?n:Infinity}
  function groupFamilies(rows){
    // WEP_TORO_ONE_SKU_V1: pair a battery kit only with its exact tool SKU.
    const toroRows=rows.filter(p=>truthy(p.Active) && clean(p.BrandID||p.BrandName).toUpperCase()==='TORO');
    const toroTools=new Map(toroRows.filter(p=>/battery/i.test(clean(p.PowerType)) && /T$/i.test(clean(p.SKU)))
      .map(p=>[clean(p.SKU).toUpperCase(),p]));
    function toroCard(p){
      const sku=clean(p.SKU).toUpperCase();
      const tool=toroTools.get(sku+'T');
      const battery=/^battery$/i.test(clean(p.PowerType));
      const kit=battery && tool && (!clean(p.ProductType) || /kit|package/i.test(clean(p.ProductType))) &&
        clean(tool.Category).toUpperCase()===clean(p.Category).toUpperCase();
      return {key:'TORO|SKU|'+(kit?sku+'T':sku),
        type:kit?(clean(p.ProductType)||'Kit'):
          (battery && /T$/.test(sku)?(clean(p.ProductType)||'Tool'):clean(p.ProductType))};
    }

    const map=new Map();

    rows.filter(x=>truthy(x.Active)).forEach(p=>{
      const brand=clean(p.BrandID)||clean(p.BrandName)||'Brand';
      const model=clean(p.Model)||clean(p.Description)||clean(p.SKU);
      const marketplaceFamily=clean(p.MarketplaceFamily);
      const normalizedBrand=brand.toUpperCase();
      const category=clean(p.Category);

      let seriesFamily='';

      if(normalizedBrand==='YANMAR' && category==='Compact Tractors'){
        seriesFamily=clean(p.Series)
          .replace(/^SM240H$/i,'SM240')
          .replace(/^YT235C$/i,'YT235')
          .replace(/^YT347C$/i,'YT347')
          .replace(/^YT359C$/i,'YT359');
      }

      const familyModel=
        (normalizedBrand==='YANMAR' && category==='Compact Tractors' ? model : '') ||
        marketplaceFamily ||
        seriesFamily ||
        (clean(p.ProductType).toLowerCase()==='tool' && !clean(p.Model)
          ? clean(p.SKU)
          : model) ||
        clean(p.SKU);

      const productSku=clean(p.SKU);
      if(!productSku||['STOP','REFERENCE_ONLY'].includes(productSku.toUpperCase()))return;
      // WEP_GREENWORKS_ONE_SKU_V1: each Greenworks SKU has its own card.
      const key=normalizedBrand==='GREENWORKS' ? 'GREENWORKS|SKU|'+clean(p.SKU).toUpperCase() : normalizedBrand==='TORO' ? toroCard(p).key : normalizedBrand==='STIHL' && /battery/i.test(clean(p.PowerType)) ? (brand+'|BATTERY|'+category+'|'+familyModel).toUpperCase() : ((/^compact tractors?$/i.test(category) ? brand+'|'+familyModel+'|'+clean(p.PowerType) : /^chainsaws?$/i.test(category) ? brand+'|SAW|'+familyModel+'|'+clean(p.PowerType) : brand+'|'+productSku).toUpperCase());
      const rowSort=sortOrderValue(p.SortOrder);

      if(!map.has(key)){
        map.set(key,{
          key,
          brand,
          model:familyModel,
          category:category||'Other',
          subcategory:clean(p.SubCategory),
          power:clean(p.PowerType),
          series:clean(p.Series),
          system:clean(p.System),
          image:clean(p.ImageURL),
          productUrl:clean(p.ProductURL),
          sort:rowSort,
          financingEligible:truthy(p.FinancingEligible),
          variants:[],
          specs:{}
        });
      }

      const f=map.get(key);

      f.sort=Math.min(f.sort,rowSort);

      if(!f.image && clean(p.ImageURL)){
        f.image=clean(p.ImageURL);
      }

      if(!f.productUrl && clean(p.ProductURL)){
        f.productUrl=clean(p.ProductURL);
      }

      if(truthy(p.FinancingEligible)){
        f.financingEligible=true;
      }

      const variantSpecs={};

      for(let i=1;i<=10;i++){
        const label=clean(p['SpecLabel'+i]);
        const value=clean(p['SpecValue'+i]);

        if(!label || !value) continue;

        variantSpecs[label]=value;

        if(!f.specs[label]){
          f.specs[label]=value;
        }
      }

      // Standardized Marketplace filter fields.
      // Preserve workbook column order.
      [
        'Transmission',
        'Tires',
        'Engine',
        'Power Type',
        'Engine Hp',
        'PTO Hp',
        'B7',
        'B8',
        'B9'
      ].forEach(label=>{
        const value=clean(p[label]);
        if(!value) return;

        variantSpecs[label]=value;

        if(!f.specs[label]){
          f.specs[label]=value;
        }
      });

      f.variants.push({
        workbookSort:clean(p.SortOrder)==='' || !Number.isFinite(Number(p.SortOrder)) ? Infinity : Number(p.SortOrder),
        sku:clean(p.SKU),
        description:clean(p.Description),
        series:clean(p.Series),
        model:clean(p.Model),
        marketplaceRow:p,
        specs:variantSpecs,
        type:normalizedBrand==='TORO'?toroCard(p).type:clean(p.ProductType),
        msrp:num(p.MSRP),
        sale:num(p.SalePrice),
        saleStart:clean(p.SaleStartDate),
        saleEnd:clean(p.SaleEndDate),
        promoName:clean(p.PromoName),
        rebate:num(p.RebateToCustomer),
        rebateStart:clean(p.RebateStartDate),
        rebateEnd:clean(p.RebateEndDate),
        price:num(p.MSRP),
        qtyDanbury:num(p.QtyDanbury),
        qtyNewMilford:num(p.QtyNewMilford),
        buyOnline:truthy(p.BuyOnlineEligible),
        localDelivery:truthy(p.LocalDelivery),
        assembly:num(p.AssemblyAmount),
        productUrl:clean(p.ProductURL)
      });
    });

    return Array.from(map.values()).map(f=>{
      f.variants.forEach(v=>{
        v.price=effectivePrice(v);
      });

      f.variants.sort((a,b)=>{
        if(isChainsawFamily(f)){
          const order=a.workbookSort-b.workbookSort;
          return Number.isNaN(order) ? 0 : order;
        }
        const ap=Number(a.price||0);
        const bp=Number(b.price||0);

        if((ap>0)!==(bp>0)){
          return ap>0 ? -1 : 1;
        }

        return (
          (ap>0 && bp>0 ? ap-bp : 0) ||
          clean(a.type).localeCompare(clean(b.type),undefined,{numeric:true,sensitivity:'base'}) ||
          clean(a.sku).localeCompare(clean(b.sku),undefined,{numeric:true,sensitivity:'base'})
        );
      });

      const positivePrices=
        f.variants
          .map(v=>v.price)
          .filter(v=>v>0);

      f.price=
        positivePrices.length
          ? Math.min(...positivePrices)
          : 0;

      if(isChainsawFamily(f)) f.price=Number(f.variants[0]?.price)||0;

      f.stock=
        f.variants.reduce(
          (n,v)=>n+v.qtyDanbury+v.qtyNewMilford,
          0
        );

      f.buyOnline=
        f.variants.some(v=>v.buyOnline);

      f.setup=
        f.variants.some(
          v=>v.localDelivery || v.assembly>0
        );

      return f;
    }).sort((a,b)=>powerRank(a.power)-powerRank(b.power)||(a.sort===b.sort?0:a.sort-b.sort));
  }
  function groupComponents(rows,kind){
    return rows.filter(x=>truthy(x.Active)).map((p,index)=>{
      const brand=clean(p.BrandID)||'STIHL';
      const model=clean(p.Model)||clean(p.BatteryID)||clean(p.ChargerID)||clean(p.ChargerName)||clean(p.Description)||clean(p.SKU);
      const price=currentPrice(p);
      const specs={};
      const pairs=kind==='battery'
        ? [['Voltage',clean(p.Voltage)||clean(p.MaxVoltage)],['Capacity',clean(p.Ah)?clean(p.Ah)+' Ah':''],['Energy',clean(p.Wh)?clean(p.Wh)+' Wh':''],['Weight',clean(p.Weight)?clean(p.Weight)+' '+clean(p.WeightUnit):'']]
        : [['System',clean(p.System)],['Voltage',clean(p.Voltage)],['Output',clean(p.OutputAmps)?clean(p.OutputAmps)+' A':''],['Input',clean(p.InputWatts)?clean(p.InputWatts)+' W':'']];
      pairs.forEach(([k,v])=>{ if(v) specs[k]=v; });
      const qty=num(p.QtyDanbury)+num(p.QtyNewMilford);
      return {
        key:(brand+'|'+kind+'|'+clean(p.SKU||model)).toUpperCase(),
        brand, model,
        category:kind==='battery'?'Batteries':'Chargers',
        subcategory:kind==='battery'?'Battery':'Charger',
        power:'Battery',
        series:kind==='battery'
          ? ((clean(p.BatteryID).match(/^(AS|AK|AP|AR)/i)||[])[1]||'').toUpperCase()
          : '',
        system:clean(p.System),
        image:clean(p.ImageURL),
        productUrl:clean(p.ProductURL),
        sort:sortOrderValue(p.SortOrder),
        variants:[{
          sku:clean(p.SKU),description:clean(p.Description)||model,type:kind==='battery'?'Battery':'Charger',
          msrp:num(p.MSRP),sale:num(p.SalePrice),price,
          qtyDanbury:num(p.QtyDanbury),qtyNewMilford:num(p.QtyNewMilford),
          buyOnline:price>0,localDelivery:false,assembly:0,productUrl:clean(p.ProductURL)
        }],
        specs,
        price,
        stock:qty,
        buyOnline:price>0,
        financingEligible:truthy(p.FinancingEligible),
        setup:false
      };
    }).sort((a,b)=>powerRank(a.power)-powerRank(b.power)||(a.sort===b.sort?0:a.sort-b.sort));
  }

  function activeFamilies(){
    if(state.shopMode==='batteries') return DATA.batteryFamilies;
    if(state.shopMode==='chargers') return DATA.chargerFamilies;
    return DATA.equipmentFamilies;
  }

    function dateActive(startRaw,endRaw){
    const now=new Date();
    const parse=(raw,endOfDay)=>{
      raw=clean(raw);
      if(!raw) return null;
      const p=raw.split('-').map(Number);
      if(p.length!==3 || p.some(x=>!Number.isFinite(x))) return null;
      return new Date(p[0],p[1]-1,p[2],endOfDay?23:0,endOfDay?59:0,endOfDay?59:0);
    };
    const start=parse(startRaw,false), end=parse(endRaw,true);
    return (!start || now>=start) && (!end || now<=end);
  }

  function shortDate(raw){
    raw=clean(raw);
    if(!raw) return '';
    const p=raw.split('-').map(Number);
    if(p.length!==3) return raw;
    return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function promoInfo(v){
    if(!v) return null;
    const msrp=Number(v.msrp||0);
    const sale=Number(v.sale||0);
    if(msrp>0 && sale>0 && sale<msrp && dateActive(v.saleStart,v.saleEnd)){
      return {type:'sale',regular:msrp,price:sale,savings:msrp-sale,end:v.saleEnd,name:clean(v.promoName)};
    }
    const rebate=Number(v.rebate||0);
    if(msrp>0 && rebate>0 && rebate<msrp && dateActive(v.rebateStart,v.rebateEnd)){
      return {type:'rebate',regular:msrp,price:msrp-rebate,savings:rebate,end:v.rebateEnd,name:'Customer Rebate'};
    }
    return null;
  }

  function effectivePrice(v){
    const promo=promoInfo(v);
    if(promo) return promo.price;
    return Number(v && v.msrp || v && v.price || 0);
  }

  function searchKey(v){
    return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'');
  }

    const distinct = a => Array.from(new Set(a.map(clean).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));

  function currentPrice(row){
    return effectivePrice({msrp:num(row?.MSRP),sale:num(row?.SalePrice),saleStart:clean(row?.SaleStartDate),saleEnd:clean(row?.SaleEndDate),rebate:num(row?.RebateToCustomer),rebateStart:clean(row?.RebateStartDate),rebateEnd:clean(row?.RebateEndDate)});
  }

  function componentName(row){
    return clean(row && (row.Model||row.BatteryID||row.ChargerID||row.ChargerName||row.Description||row.SKU))
      .replace(/\s+/g,' ').trim();
  }

  function enrichRecommendedPackages(families){
    const key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
    const active=row=>clean(row.Active)===''||truthy(row.Active);
    const compatBySku=new Map(DATA.compatibility.filter(active).map(x=>[key(x.ToolSKU),x]));
    const batteryById=new Map(DATA.batteries.filter(active).map(x=>[key(x.BatteryID),x]));
    const chargerById=new Map(DATA.chargers.filter(active).map(x=>[key(x.ChargerID),x]));
    families.forEach(f=>{
      if(clean(f.brand).toUpperCase()!=='STIHL'||!/battery/i.test(f.power)||f.variants.some(v=>/kit|package/i.test(v.type)))return;
      for(const tool of f.variants.slice()){
        if(!(tool.price>0))continue;
        let compat=compatBySku.get(key(tool.sku));
        if(!compat){
          const matches=DATA.compatibility.filter(row=>active(row)&&key(row.Model)&&key(row.Model)===key(tool.model));
          const signatures=new Set(matches.map(row=>[key(row.RecommendedBatteryID1),row.RecommendedBatteryQty1||1,key(row.RecommendedChargerID1),row.RecommendedChargerQty1||1].join('|')));
          if(signatures.size===1)compat=matches[0];
        }
        if(!compat)continue;
        const battery=batteryById.get(key(compat.RecommendedBatteryID1)),charger=chargerById.get(key(compat.RecommendedChargerID1));
        if(!battery||!charger||!clean(battery.SKU)||!clean(charger.SKU))continue;
        const batteryPrice=currentPrice(battery),chargerPrice=currentPrice(charger);
        if(!(batteryPrice>0&&chargerPrice>0))continue;
        const batteryQty=Math.max(1,num(compat.RecommendedBatteryQty1)||1),chargerQty=Math.max(1,num(compat.RecommendedChargerQty1)||1);
        if(!Number.isInteger(batteryQty)||!Number.isInteger(chargerQty))continue;
        const batteryLabel=(batteryQty>1?batteryQty+' ':'')+clean(battery.BatteryID)+' Battery',chargerLabel=(chargerQty>1?chargerQty+' ':'')+clean(charger.ChargerID)+' Charger';
        f.variants.push({...tool,description:tool.description+' + '+batteryLabel+' + '+chargerLabel,type:'Package',msrp:0,sale:0,rebate:0,
          price:tool.price+batteryPrice*batteryQty+chargerPrice*chargerQty,recommendedPackage:true,
          packageItems:[{sku:clean(battery.SKU),name:batteryLabel,quantity:batteryQty,price:batteryPrice},{sku:clean(charger.SKU),name:chargerLabel,quantity:chargerQty,price:chargerPrice}],
          packageIncludes:batteryLabel+' and '+chargerLabel+' included'});
      }
    });return families;
  }

  function enrichFactoryPackageSavings(families){
    const batteryById=new Map(DATA.batteries.map(x=>[clean(x.BatteryID).replace(/\s+/g,'').toUpperCase(),x]));
    const chargerById=new Map(DATA.chargers.map(x=>[clean(x.ChargerID).replace(/\s+/g,'').toUpperCase(),x]));

    families.forEach(f=>{
      const tool=f.variants.find(v=>!/kit|package/i.test(v.type));
      if(!tool || !(tool.price>0)) return;

      f.variants.filter(v=>/kit|package/i.test(v.type) && !v.recommendedPackage).forEach(v=>{
        const d=clean(v.description);
        const batt=d.match(/\b(?:(\d+)\s*[-x]?\s*)?((?:AS|AK|AP|AR)\s*\d+(?:\.\d+)?\s*[A-Z]?)\s*Batter(?:y|ies)?\b/i);
        const charger=d.match(/\b(AL\s*\d+(?:-\d+)?)\b/i);
        if(!batt && !charger) return;

        const parts=[];
        let components=0;

        if(batt){
          const qty=Math.max(1,Number(batt[1])||1);
          const id=batt[2].replace(/\s+/g,'').toUpperCase();
          const row=batteryById.get(id);
          const price=row?currentPrice(row):0;
          const display=(clean(row && row.BatteryID)||batt[2].replace(/\s+/g,' ').toUpperCase());
          if(price>0){
            components+=price*qty;
            parts.push((qty>1?qty+' ':'')+display+' '+(qty>1?'Batteries':'Battery'));
          }
        }

        if(charger){
          const id=charger[1].replace(/\s+/g,'').toUpperCase();
          const row=chargerById.get(id);
          const price=row?currentPrice(row):0;
          const display=clean(row && row.ChargerID)||id;
          if(price>0){
            components+=price;
            parts.push(display+' Charger');
          }
        }

        if(parts.length) v.packageIncludes=parts.join(' and ')+' included';
        if(components>0){
          v.packageValue=tool.price+components;
          v.packageSavings=Math.max(0,v.packageValue-v.price);
        }
      });
    });
    return families;
  }

  function financeGroupColumns(f){
    const cols=new Set(['Group_ALL_STIHL']);
    const values=[f.series,f.category,f.subcategory].map(clean).filter(Boolean);
    values.forEach(v=>{
      cols.add('Group_'+v);
      const compact=v.toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(compact) cols.add('Group_'+compact);
    });
    const model=clean(f.model).toUpperCase().replace(/[^A-Z0-9]/g,'');
    const series=clean(f.series).toUpperCase().replace(/[^A-Z0-9]/g,'');
    [model,series].forEach(v=>{
      if(/^RZ1/.test(v)) cols.add('Group_RZ100');
      if(/^RZ2/.test(v)) cols.add('Group_RZ200');
      if(/^RZ5/.test(v)) cols.add('Group_RZ500');
      if(/^RZ7/.test(v)) cols.add('Group_RZ700');
      if(/^RZ752/.test(v)) cols.add('Group_RZ752');
      if(/^RZ9/.test(v)) cols.add('Group_RZ900');
      if(/^AZA/.test(v)) cols.add('Group_AZA');
      if(/^RZA/.test(v)) cols.add('Group_RZA');
      if(/^RMA/.test(v)) cols.add('Group_RMA');
      if(/^RM/.test(v)) cols.add('Group_RM');
      if(/^FSA120/.test(v)) cols.add('FSA 120');
    });
    if([model,series].some(v=>/^RZ[0-9]|^AZA|^RZA/.test(v)) || values.some(v=>/ZERO[- ]?TURN/i.test(v))){
      cols.add('Group_ALL_ZTR');
    }
    return Array.from(cols);
  }

  function bestFinanceProgram(f){
    if(!f || !f.financingEligible || !DATA.financePrograms.length) return null;
    const amount=Number(f.price||0);
    if(!(amount>0)) return null;
    const groups=financeGroupColumns(f);
    const brand=clean(f.brand).toUpperCase();
    const programs=DATA.financePrograms.filter(p=>{
      if(!truthy(p.Active) || !truthy(p.Public) || !truthy(p.Display)) return false;
      if(!dateActive(p.StartDate,p.EndDate)) return false;
      if(clean(p.BrandID) && clean(p.BrandID).toUpperCase()!==brand) return false;
      const min=num(p.MinAmount), max=num(p.MaxAmount);
      if(min>0 && amount<min) return false;
      if(max>0 && amount>max) return false;
      return groups.some(g=>truthy(p[g]));
    });
    if(!programs.length) return null;
    return programs.sort((a,b)=>{
      const aa=num(a.APR), ab=num(b.APR);
      const za=aa===0?0:1, zb=ab===0?0:1;
      return za-zb || aa-ab || num(b.TermMonths)-num(a.TermMonths) || num(a.SortOrder)-num(b.SortOrder);
    })[0]||null;
  }

  function financeOfferData(f){
    const p=bestFinanceProgram(f);
    if(!p) return null;
    const raw=num(p.APR);
    const apr=raw>0 && raw<1 ? raw*100 : raw;
    const aprLabel=apr.toFixed(2)+'%';
    return {
      program:p,
      aprLabel,
      termMonths:clean(p.TermMonths),
      label:aprLabel+' for '+clean(p.TermMonths)+' Months',
      sublabel:''
    };
  }

  // YANMAR_SELECTED_CONFIGURATION_V1
  function isYanmarTractor(f){
    return clean(f.brand).toUpperCase()==='YANMAR'&&clean(f.category)==='Compact Tractors';
  }
  function yanmarSelectedVariant(f){
    const candidates=relevantVariants(f);
    return candidates.filter(v=>Number(v.price)>0).slice().sort((a,b)=>(isCompactTractor(f)?Number(!compactFlags(a).every((on,i)=>on===(i===0)))-Number(!compactFlags(b).every((on,i)=>on===(i===0)))||Number(compactTire(a)!=='R-4')-Number(compactTire(b)!=='R-4'):0)||(a.workbookSort===b.workbookSort?0:a.workbookSort-b.workbookSort)||Number(a.price)-Number(b.price))[0]||candidates[0]||(f.variants||[])[0]||{};
  }
  // WEP_COMPACT_CARD_OPTIONS_V1: select complete catalog SKUs, never add guessed option prices.
  function isCompactTractor(f){return clean(f.brand).toUpperCase()==='YANMAR'&&/^compact tractors?$/i.test(clean(f.category));}
  const compactFields=[['Loader','P1-Loader'],['Backhoe','P2-Backhoe'],['Mower','P3-Mower'],['Cab','P4-Cab']];
  const compactTires=[['R-1','Ag','Agricultural'],['R-3','Turf','Turf'],['R-4','Industrial','Industrial'],['Hybrid','Hybrid','Hybrid']];
  function compactVariants(f){
    // These cab versions are separate workbook models of the same YT platform.
    const model=clean(f.model),match=model.match(/^(YT235|YT347|YT359)C?$/i);
    if(!isYanmarTractor(f)||!match)return f.variants||[];
    const base=match[1].toUpperCase();
    const peers=(DATA.equipmentFamilies||[]).filter(peer=>isYanmarTractor(peer)&&clean(peer.brand).toUpperCase()===clean(f.brand).toUpperCase()&&[base,base+'C'].includes(clean(peer.model).toUpperCase()));
    return [...new Set([...(f.variants||[]),...peers.flatMap(peer=>peer.variants||[])])];
  }
  function selectCompactVariant(f,v){
    if(selectedStock(f))return false;
    f.financePriority=Date.now();
    if(!compactVariants(f).includes(v))return false;
    const selection=cardSelectionFor(f),index=f.variants.indexOf(v);
    cardSelections.set(f.key,{...selection,index:index>=0?index:selection.index,compactVariant:v});
    return true;
  }
  function compactFlags(v){return compactFields.map(([,field])=>truthy((v.marketplaceRow||{})[field]));}
  function compactTire(v){
    const row=v.marketplaceRow||{},value=clean(row['B2-Tires']||row.Tires||v.specs?.Tires).toLowerCase().replace(/[\s-]/g,'');
    if(/^(ag|agricultural|r1)$/.test(value))return 'R-1';
    if(/^(turf|r3)$/.test(value))return 'R-3';
    if(/^(industrial|r4)$/.test(value))return 'R-4';
    if(/hybrid|^r14/.test(value))return 'Hybrid';
    return clean(row['B2-Tires']||row.Tires||v.specs?.Tires);
  }
  function compactFilterKey(){
    return JSON.stringify([state.shopMode,[...state.packageComponents].sort(),state.promoOnly,[...state.specFilters].map(([k,v])=>[k,[...v].sort()]).sort(),state.seriesFilter,state.modelFilter]);
  }
  function compactOptionCandidate(f,fieldIndex){
    if(selectedStock(f))return null;
    const current=selectedPriceVariant(f),flags=compactFlags(current),wanted=!flags[fieldIndex],tire=compactTire(current);
    return compactVariants(f).filter(v=>v.price>0&&compactTire(v)===tire&&compactFlags(v)[fieldIndex]===wanted&&(!wanted||flags.every((on,i)=>i===fieldIndex||!on||compactFlags(v)[i])))
      .sort((a,b)=>{
        const distance=v=>compactFlags(v).reduce((total,on,i)=>total+(i!==fieldIndex&&on!==flags[i]?1:0),0);
        return distance(a)-distance(b)||a.price-b.price||a.workbookSort-b.workbookSort;
      })[0]||null;
  }
  function compactTireCandidate(f,tire){
    if(selectedStock(f))return null;
    const flags=compactFlags(selectedPriceVariant(f));
    return compactVariants(f).filter(v=>v.price>0&&compactTire(v)===tire&&compactFlags(v).every((on,i)=>on===flags[i]))
      .sort((a,b)=>a.price-b.price||a.workbookSort-b.workbookSort)[0]||null;
  }
  function compactButtonStyle(active,disabled,header){
    return 'padding:4px 7px;min-height:28px;border:1px solid '+(header?'#d4e8d9':'#9ebda7')+';border-radius:5px;font:inherit;font-size:11px;font-weight:800;white-space:nowrap;background:'+(active?'#d5efdc':header?'#fff':'#f7faf8')+';color:#155d2d;cursor:'+(disabled?'default':'pointer')+';opacity:'+(disabled&&!active?'.45':'1');
  }
  function compactHeaderOptions(f){
    if(!isCompactTractor(f))return '';
    const flags=compactFlags(selectedPriceVariant(f));
    return '<div class="market-factory-options" style="text-align:center;margin:8px 0"><div class="market-package-row-label">Factory Installed</div><span role="group" aria-label="Factory-installed options" style="display:inline-flex;gap:4px;justify-content:center;flex-wrap:wrap">'+compactFields.map(([label],i)=>{
      const offered=compactVariants(f).some(v=>compactFlags(v)[i]);if(!offered||(selectedStock(f)&&!flags[i]))return '';
      const candidate=compactOptionCandidate(f,i),disabled=!candidate;
      if(!flags[i]&&!candidate)return '';
      const title=disabled?(flags[i]?label+' included on this model':label+' is not listed with these tires'):(flags[i]?'Remove ':'Select ')+label;
      return '<button type="button" data-compact-family="'+esc(f.key)+'" data-compact-option="'+i+'" aria-pressed="'+flags[i]+'" title="'+esc(title)+'" '+(disabled?'disabled ':'')+'style="'+compactButtonStyle(flags[i],disabled,true)+'">'+label+'</button>';
    }).join('')+'</span></div>';
  }
  function compactTreadSvg(type){
    let tread='';
    for(let y=13;y<78;y+=type==='R-3'?12:19){
      if(type==='R-3')for(let x=16;x<65;x+=15)tread+='<rect x="'+x+'" y="'+y+'" width="10" height="7" rx="2" fill="#727a75"/>';
      else{
        tread+='<path d="M15 '+y+' L36 '+(y+12)+' M65 '+y+' L44 '+(y+12)+'" stroke="#727a75" stroke-width="'+(type==='R-1'?6:9)+'" fill="none"/>';
        if(type==='Hybrid')tread+='<rect x="35" y="'+(y+8)+'" width="10" height="9" rx="2" fill="#919b95"/>';
      }
    }
    return '<svg width="53" height="62" viewBox="0 0 80 94" role="img" aria-label="'+esc(type)+' illustrative tread"><rect x="10" y="3" width="60" height="88" rx="17" fill="#252c28"/>'+tread+'</svg>';
  }
  function compactTireGuide(f){
    const descriptions={'R-1':'Agricultural tire','R-3':'Turf tire','R-4':'Industrial tire','Hybrid':'Mixed tread design'};
    return '<details class="market-tire-guide" style="position:relative;text-align:left;font-size:11px"><summary style="cursor:pointer;text-align:center;color:#176c34;font-weight:800;padding:5px" aria-label="Tire guide">Guide</summary><div style="position:absolute;z-index:40;right:0;top:100%;width:300px;max-width:75vw;padding:12px;border:1px solid #9ebda7;border-radius:8px;background:white;color:#24342a;box-shadow:0 5px 20px #0003"><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;text-align:center">'+compactTires.map(([code])=>'<div>'+compactTreadSvg(code)+'<div style="font-weight:900">'+code+'</div><div>'+descriptions[code]+'</div></div>').join('')+'</div><p style="font-size:10px;line-height:1.4;margin:9px 0 0">Illustrative tread patterns. Actual tires vary by model. Selectable choices match the listed tractor configuration.</p><a href="https://www.yanmar.com/eu/agri/wp-content/uploads/sites/12/2023/02/EN_SA221_424_OPERATORS-MANUAL_WEB_LR.pdf" target="_blank" rel="noopener" style="font-size:10px;color:#176c34">YANMAR tire terminology</a> · <a href="https://www.titan-intl.com/r14t" target="_blank" rel="noopener" style="font-size:10px;color:#176c34">Hybrid tire example</a></div></details>';
  }
  function compactTireMarkup(f){
    if(!isCompactTractor(f))return '';
    const selected=selectedPriceVariant(f),tire=compactTire(selected),flags=compactFlags(selected);
    const offered=compactTires.filter(([code])=>selectedStock(f)?code===tire:compactVariants(f).some(v=>compactTire(v)===code));
    const extra=tire&&!compactTires.some(([code])=>code===tire)?[[tire]]:[];
    return '<div class="market-compact-tires" style="margin:7px 0;text-align:center"><div class="market-compact-tire-label"><div class="market-package-row-label">Tires</div>'+compactTireGuide(f)+'</div><div role="group" aria-label="Tire options" style="display:flex;justify-content:center;gap:4px;flex-wrap:wrap">'+offered.concat(extra).map(([code])=>{
      const active=code===tire,candidate=compactTireCandidate(f,code),disabled=!candidate;
      return '<button type="button" data-compact-family="'+esc(f.key)+'" data-compact-tire="'+esc(code)+'" aria-pressed="'+active+'" '+(disabled?'disabled ':'')+'title="'+esc(disabled?'Not listed with the selected factory options':'Select '+code+' tires')+'" style="'+compactButtonStyle(active,disabled,false)+'">'+esc(code)+'</button>';
    }).join('')+'</div>'+'</div>';
  }
  function handleCompactSelection(event){
    const button=event.target.closest('[data-compact-family]');if(!button)return false;
    const f=activeFamilies().find(f=>f.key===button.dataset.compactFamily);if(!f||!isCompactTractor(f)||button.disabled)return true;
    const option=button.dataset.compactOption;
    const candidate=button.dataset.compactSku?compactVariants(f).find(v=>skuKey(v.sku)===skuKey(button.dataset.compactSku)):option!==undefined?compactOptionCandidate(f,Number(option)):compactTireCandidate(f,button.dataset.compactTire);
    if(!candidate)return true;
    if(selectCompactVariant(f,candidate)){
      refreshSelectedCard(f);
      const selector=button.dataset.compactSku?'[data-compact-sku="'+CSS.escape(button.dataset.compactSku)+'"]':option!==undefined?'[data-compact-option="'+option+'"]':'[data-compact-tire="'+CSS.escape(button.dataset.compactTire)+'"]';
      document.querySelector('[data-compact-family="'+CSS.escape(f.key)+'"]'+selector)?.focus({preventScroll:true});
    }
    return true;
  }

  // WEP_SERIALIZED_STOCK_V1: stock is an explicit, immutable inventory selection.
  function stockChoices(f){
    const variants=isCompactTractor(f)?compactVariants(f):f.variants||[];
    const inventory=inventorySkuSet(f.brand),choices=[],seen=new Set();
    for(const variant of variants){
      for(const unit of inventory.get(skuKey(variant.sku))?.selections||[]){
        const id=clean(unit.selectionId);
        if(unit.serialized!==true||!clean(unit.unitRef)||!id||num(unit.quantity)<=0||/^INCOMING:/i.test(id)||seen.has(id))continue;
        seen.add(id);choices.push({variant,...unit});
      }
    }
    return choices;
  }
  function selectedStock(f){return cardSelectionFor(f).stockUnit||null;}
  function selectedInventoryId(f){
    const unit=selectedStock(f);
    return unit?unit.selectionId:(isCompactTractor(f)||stockChoices(f).length?'':undefined);
  }
  function stockChoiceText(f,unit){
    if(!isCompactTractor(f))return clean(unit.variant.description)||clean(f.model);
    const names=compactFields.filter((_,i)=>compactFlags(unit.variant)[i]).map(x=>x[0]);
    const tire=compactTire(unit.variant);if(tire)names.push(tire+' Tires');
    const description=names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0]||'';
    return (clean(unit.variant.model)||clean(f.model))+(description?' with '+description:'');
  }
  function stockHeaderMarkup(f){
    const choices=stockChoices(f),stock=selectedStock(f);if(!choices.length&&!stock)return '';
    return '<button type="button" data-stock-toggle="'+esc(f.key)+'" style="margin-left:auto;padding:5px 9px;border:1px solid #9ebda7;border-radius:5px;background:#fff;color:#155d2d;font-size:12px;font-weight:800;cursor:pointer">'+(stock?'Build / Order':'View In-Stock'+(choices.length>1?' ('+choices.length+')':''))+'</button>';
  }
  function stockUnitMarkup(f){
    const unit=selectedStock(f);if(!unit)return '';
    return '<div class="market-selected-stock" style="text-align:center;margin:7px 0;font-size:12px"><strong>In Stock'+(clean(unit.store)?' — '+esc(unit.store):'')+'</strong>'+
      (stockChoices(f).length>1?' <button type="button" data-stock-open="'+esc(f.key)+'" style="border:0;background:transparent;padding:3px;color:#176c34;text-decoration:underline;cursor:pointer;font:inherit">Change Unit</button>':'')+'</div>';
  }
  function chooseStockUnit(f,id){
    const unit=stockChoices(f).find(x=>x.selectionId===id);if(!unit)return false;
    const previous=cardSelectionFor(f),orderSelection=previous.orderSelection||{...previous};
    cardSelections.set(f.key,{...previous,quantity:1,stockUnit:unit,orderSelection});
    f.financePriority=Date.now();return true;
  }
  function openStockChooser(f,opener){
    const choices=stockChoices(f);if(!choices.length)return;
    const previous=document.querySelector('dialog[data-stock-chooser]');if(previous){previous.close();previous.remove();}
    const dialog=document.createElement('dialog');
    dialog.className='market-stock-dialog';dialog.dataset.stockChooser=f.key;
    dialog.setAttribute('aria-labelledby','market-stock-title');
    dialog.style.cssText='width:min(520px,calc(100vw - 32px));max-height:85vh;box-sizing:border-box;overflow:auto;padding:22px;border:1px solid #9ebda7;border-radius:12px;background:white;color:#173c24;box-shadow:0 12px 50px #0005';
    dialog.innerHTML='<style>.market-stock-dialog::backdrop{background:#0007}.market-stock-dialog button:disabled{opacity:.45;cursor:default}</style>'+
      '<h2 id="market-stock-title" style="font-size:21px;margin:0 0 7px">Choose an in-stock '+esc(f.model)+'</h2><p style="font-size:14px;margin:0 0 16px">Select one configuration.</p>'+
      '<div style="display:grid;gap:10px">'+choices.map((unit,index)=>{
        const label=stockChoiceText(f,unit),duplicate=choices.filter(other=>stockChoiceText(f,other)===label&&clean(other.store)===clean(unit.store)).length>1;
        return '<label style="display:flex;align-items:center;gap:11px;padding:14px;border:1px solid #9ebda7;border-radius:8px;background:#f7faf8;cursor:pointer"><input type="radio" name="market-stock-unit" value="'+index+'" style="flex:0 0 auto;width:18px;height:18px;accent-color:#176c34"><span><strong style="display:block;font-size:15px;line-height:1.4">'+esc(label)+'</strong><small style="display:block;margin-top:3px">'+esc(clean(unit.store))+(duplicate?' · Unit '+(index+1):'')+'</small></span></label>';
      }).join('')+'</div><p data-stock-error role="status" style="font-size:13px;color:#a32622;margin:10px 0"></p>'+
      '<div style="display:flex;justify-content:flex-end;gap:9px;margin-top:17px"><button type="button" data-stock-cancel style="padding:9px 15px;border:1px solid #9ebda7;border-radius:6px;background:white;color:#176c34;font:inherit;cursor:pointer">Cancel</button><button type="button" data-stock-confirm disabled style="padding:9px 15px;border:1px solid #176c34;border-radius:6px;background:#176c34;color:white;font:inherit;font-weight:800;cursor:pointer">View Selected Unit</button></div>';
    const confirm=dialog.querySelector('[data-stock-confirm]');
    dialog.addEventListener('change',()=>{confirm.disabled=!dialog.querySelector('input[name="market-stock-unit"]:checked');});
    dialog.querySelector('[data-stock-cancel]').addEventListener('click',()=>dialog.close());
    confirm.addEventListener('click',()=>{
      const checked=dialog.querySelector('input[name="market-stock-unit"]:checked');if(!checked)return;
      const unit=choices[Number(checked.value)];
      if(!unit||!chooseStockUnit(f,unit.selectionId)){
        dialog.querySelector('[data-stock-error]').textContent='This unit is no longer available. Close this window and refresh the page.';return;
      }
      dialog.close();refreshSelectedCard(f);
    });
    dialog.addEventListener('close',()=>{
      dialog.remove();
      const target=opener?.isConnected?opener:document.querySelector('[data-stock-toggle="'+CSS.escape(f.key)+'"]');
      target?.focus({preventScroll:true});
    });
    document.body.appendChild(dialog);dialog.showModal();
  }
  function handleStockToggle(event){
    const open=event.target.closest('[data-stock-open]');
    const button=open||event.target.closest('[data-stock-toggle]');if(!button)return false;
    const f=activeFamilies().find(x=>x.key===(open?open.dataset.stockOpen:button.dataset.stockToggle));if(!f)return true;
    const selection=cardSelectionFor(f);
    if(!open&&selection.stockUnit){cardSelections.set(f.key,selection.orderSelection);f.financePriority=Date.now();refreshSelectedCard(f);}
    else openStockChooser(f,button);
    return true;
  }

  // WEP_CARD_SELECTION_V1: one selection controls boxes, dropdown, cart and payment links.
  const cardSelections=new Map();
  function priceChoices(f){
    if(isCompactTractor(f))return [{label:'MSRP:',v:yanmarSelectedVariant(f),variants:compactVariants(f),isPackage:false}];
    if(isChainsawFamily(f)){
      const variants=f.variants||[],first=variants[0];if(!first)return [];
      const kinds=[/kit|package/i.test(first.type)];
      if(variants.some(v=>/kit|package/i.test(v.type)!==kinds[0]))kinds.push(!kinds[0]);
      return kinds.map(kind=>{const group=variants.filter(v=>/kit|package/i.test(v.type)===kind);return {label:kind?'Package:':'MSRP:',v:group[0],variants:group,isPackage:kind};});
    }
    const groups=new Map();
    (f.variants||[]).forEach(v=>{
      const raw=clean(v.type),match=raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/),base=clean(match?match[1]:raw);
      const label=(/kit|package/i.test(base)?'Package':'MSRP')+(match?' ('+clean(match[2])+')':'');
      if(!groups.has(label))groups.set(label,[]);groups.get(label).push(v);
    });
    const choices=[];
    const rank=label=>/49-State/i.test(label)?0:/50-State/i.test(label)?1:2;
    [...groups.entries()].sort((a,b)=>rank(a[0])-rank(b[0])).forEach(([label,variants])=>{
      const isPackage=/^Package/.test(label),prices=new Set(variants.map(v=>Number(v.price)||0));
      if(prices.size>1)variants.forEach(v=>choices.push({label,v,variants:[v],isPackage}));
      else choices.push({label,v:variants[0],variants,isPackage});
    });
    return choices;
  }
  function cardSelectionFor(f){
    let selection=cardSelections.get(f.key);
    const filterKey=isCompactTractor(f)?compactFilterKey():null;
    if(!selection||!f.variants[selection.index]||(isCompactTractor(f)&&selection.compactFilterKey!==filterKey)){
      const first=(!isCompactTractor(f)&&relevantVariants(f).find(v=>!v.recommendedPackage&&!/kit|package/i.test(v.type)))||priceChoices(f)[0]?.v||f.variants[0];
      selection={index:Math.max(0,f.variants.indexOf(first)),quantity:1,compactFilterKey:filterKey};cardSelections.set(f.key,selection);
    }
    return selection;
  }
  function selectedPriceVariant(f){const selection=cardSelectionFor(f),matched=relevantVariants(f);if(selection.packageVariant&&!selection.stockUnit)return selection.packageVariant;if(selection.stockUnit&&matched.includes(selection.stockUnit.variant))return selection.stockUnit.variant;const chosen=selection.compactVariant||f.variants[selection.index];return matched.includes(chosen)?chosen:matched[0]||f.variants[0]||{};}
  function selectedPriceQuantity(f){return selectedStock(f)?1:cardSelectionFor(f).quantity;}
  function maximumCardQuantity(v){return Math.max(1,Math.min(99,...(v.recommendedPackage?v.packageItems||[]:[]).map(item=>Math.floor(99/Math.max(1,Number(item.quantity)||1)))));}
  function selectCardVariant(f,index,quantity){
    if(selectedStock(f))return false;
    f.financePriority=Date.now();
    index=Number(index);if(!Number.isInteger(index)||!f.variants[index])return false;
    const previous=cardSelectionFor(f),limit=maximumCardQuantity(f.variants[index]),qty=quantity===undefined?Math.min(previous.quantity,limit):Number(quantity);
    if(!Number.isInteger(qty)||qty<1||qty>limit)return false;
    cardSelections.set(f.key,{index,quantity:qty,compactFilterKey:previous.compactFilterKey});return true;
  }
  function selectPackageVariant(f,v){
    const previous=cardSelectionFor(f);if(previous.stockUnit)return false;
    cardSelections.set(f.key,{...previous,index:Math.max(0,f.variants.indexOf(v)),packageVariant:v});f.financePriority=Date.now();return true;
  }
  function selectedPaymentRow(v){return {...(v.marketplaceRow||{}),__packageItems:v.recommendedPackage?v.packageItems||[]:[]};}
  function paymentSelectionUrl(f){
    const v=selectedPriceVariant(f),params=new URLSearchParams({brand:clean(f.brand).toUpperCase(),sku:clean(v.sku),quantity:String(selectedPriceQuantity(f)),return:location.pathname+location.search+location.hash});
    if(v.recommendedPackage)params.set('package','1');
    const inventoryId=selectedInventoryId(f),stock=selectedStock(f);
    if(stock)params.set('unit',stock.unitRef);else if(inventoryId!==undefined)params.set('inventoryId',inventoryId);
    const currentPage=new URL(location.href);
    const localPreview=/^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/i.test(currentPage.hostname);
    const paymentPage=new URL('payment-options.html',localPreview?currentPage.href:(document.baseURI||currentPage.href));
    paymentPage.search=params.toString();return paymentPage.href;
  }
  function refreshSelectedCard(f){
    const host=document.querySelector('.market-card[data-key="'+CSS.escape(f.key)+'"]');
    if(host)host.outerHTML=card(f);fitPriceDescriptions();
  }
  function handlePriceSelection(event){
    const control=event.target.closest('[data-price-select]');if(!control)return false;
    const f=activeFamilies().find(f=>f.key===control.dataset.priceSelect);
    if(f&&selectCardVariant(f,control.dataset.priceIndex)){
      const index=cardSelectionFor(f).index;refreshSelectedCard(f);
      document.querySelector('[data-price-select="'+CSS.escape(f.key)+'"][data-price-index="'+index+'"]')?.focus({preventScroll:true});
    }
    return true;
  }
  function selectedCartMarkup(f){
    const selected=selectedPriceVariant(f),quantity=selectedPriceQuantity(f),eligible=f.variants.filter(v=>v.buyOnline&&v.price>0);
    if(!eligible.length)return '';
    const canBuy=eligible.includes(selected);
    const options=eligible.map(v=>'<option value="'+esc(v.sku+'|'+f.variants.indexOf(v))+'" '+(v===selected?'selected':'')+'>'+esc((v.recommendedPackage?'Recommended Package — '+v.description:isChainsawFamily(f)?sawConfigurationLabel(v):(/kit|package/i.test(v.type)?'Package':'Unit')+' — '+v.description)+' — '+money(v.price))+'</option>').join('');
    return '<div class="market-cart-controls"><select data-cart-variant="'+esc(f.key)+'" aria-label="Choose Purchase Option">'+(!canBuy?'<option value="" selected disabled>Choose Purchase Option</option>':'')+options+'</select>'+
      '<input data-cart-qty="'+esc(f.key)+'" type="number" min="1" max="'+maximumCardQuantity(selected)+'" value="'+quantity+'" aria-label="Quantity">'+
      '<button type="button" data-add-cart="'+esc(f.key)+'" '+(!canBuy?'disabled':'')+'>Add to Cart</button></div>';
  }

  function marketplaceFinanceVariant(f){return selectedPriceVariant(f);}

  function financeSummaryKey(f){
    const variant=marketplaceFinanceVariant(f);
    return clean(f.brand).toUpperCase()+'|'+skuKey(variant.sku)+'|'+cardSelectionFor(f).index+'|'+selectedPriceQuantity(f)+'|'+(selectedInventoryId(f)===undefined?'AUTO':selectedInventoryId(f)||'ORDER')+'|'+JSON.stringify(variant.recommendedPackage?variant.packageItems||[]:[]);
  }

  function cardFinanceMarkup(f,buildHref){
    const key=financeSummaryKey(f),url=new URL(buildHref||catalogBuildUrl(f));url.hash='';
    const bottom=new URL(url);bottom.hash='wep-itemized-quote';
    const links='<div class="market-card-price-links"><a class="market-payment-options" target="_blank" rel="noopener noreferrer" href="'+esc(url.href)+'">View All Promotions</a><a class="market-payment-options" target="_blank" rel="noopener noreferrer" href="'+esc(bottom.href)+'">Out-the-Door Price</a></div>';
    if(!key || /\|$/.test(key))return links;
    const summary=DATA.financeSummaryCache.get(key);if(!summary)requestMarketplaceFinanceSummary(f);
    if(!summary||summary.none)return (!summary?'<div class="market-finance-pending" role="status">Updating financing…</div>':'')+links;
    return '<div class="market-card-finance"><div class="market-card-finance-apr">'+esc(summary.aprLabel)+' for '+esc(summary.termMonths)+' Months</div>'+'<div class="market-card-finance-payment"><strong>'+money(summary.monthly)+'<span> per Month (est.)</span></strong></div>'+(summary.requiredDown>0?'<div class="market-card-finance-down">'+money(summary.requiredDown)+' required down</div>':'')+((summary.expirationLabel||((isCompactTractor(f)||window.WestEndEquipmentPackages?.tool(f))&&summary.rebateCompatible===false))?'<div class="market-card-finance-note">'+esc(summary.expirationLabel||'')+((isCompactTractor(f)||window.WestEndEquipmentPackages?.tool(f))&&summary.rebateCompatible===false?' <span class="market-card-finance-rebate">(In lieu of customer rebate)</span>':'')+'</div>':'')+links+'</div>';
  }

  async function requestMarketplaceFinanceSummary(f){
    const key=financeSummaryKey(f);
    if(!key || /\|$/.test(key) ||
       DATA.financeSummaryCache.has(key) ||
       DATA.financeSummaryPending.has(key)){
      return;
    }

    const variant=marketplaceFinanceVariant(f);
    const sku=clean(variant.sku),quantity=selectedPriceQuantity(f),row=selectedPaymentRow(variant),inventoryId=selectedInventoryId(f),stock=selectedStock(f);
    const brandId=clean(f.brand).toUpperCase();

    const request=(async()=>{
      try{
        const programs=await window.WestEndPayments.programs(brandId,sku,inventoryId,quantity,row.__packageItems);
        const program=bestMarketplaceFinanceProgram(programs);
        if(!program){
          DATA.financeSummaryCache.set(key,{none:true});
          return;
        }
        if(financeSummaryKey(f)!==key)return;
        const summary=await window.WestEndPayments.quote(brandId,sku,row,'finance',program,inventoryId,quantity,{
          shouldRun:()=>financeSummaryKey(f)===key,
          priority:()=>{
            if(f.financePriority)return f.financePriority;
            const element=document.querySelector('.market-card[data-key="'+CSS.escape(f.key)+'"]');
            const bounds=element?.getBoundingClientRect?.();
            return bounds&&bounds.bottom>0&&bounds.top<(window.innerHeight||800)?1:0;
          }
        });
        // Public card estimates use published manufacturer prices, not private dealer discounts.
        const publishedPromo=promoInfo(variant),allowsRebate=window.WestEndPayments.programAllowsRebate(program);
        const configuredPrice=window.WestEndEquipmentPackages?.publishedPrice(f,allowsRebate);
        const publishedUnit=Number.isFinite(configuredPrice)?configuredPrice:!allowsRebate&&(isCompactTractor(f)||publishedPromo?.type==='rebate')?variant.msrp:variant.price;
        const publishedSelling=Math.max(0,Number(publishedUnit)||0)*quantity;
        const publishedSubtotal=publishedSelling+summary.freight;
        const publishedTax=/^(F|FALSE|N|NO|0)$/i.test(clean(row.Taxable))?0:Math.round((publishedSubtotal*0.0635+Number.EPSILON)*100)/100;
        const publishedTotal=publishedSubtotal+publishedTax;
        const publishedDown=window.WestEndPayments.programMinimumDown(program,publishedTotal);
        const publishedFinanced=Math.max(publishedTotal-publishedDown,0)+summary.applicationFee;
        const displaySummary={...summary,requiredDown:publishedDown,monthly:window.WestEndPayments.monthlyPayment(publishedFinanced,summary.apr,summary.termMonths)};
        DATA.financeSummaryCache.set(key,stock?summary:displaySummary);
      }catch(error){
        if(error.name==='AbortError')return;
        console.warn('Marketplace finance summary unavailable for '+key,error);
        DATA.financeSummaryCache.set(key,{none:true});
      }finally{
        DATA.financeSummaryPending.delete(key);
        if(financeSummaryKey(f)===key)refreshSelectedCard(f);
      }
    })();

    DATA.financeSummaryPending.set(key,request);
  }

    function engineValue(f){
    for(const [k,v] of Object.entries(f.specs)){
      if(/engine\s*(brand|make|manufacturer)?$/i.test(k) || /^engine$/i.test(k)) return v;
    }
    return '';
  }

  function widthPair(f){
    const patterns=[/cut(ting)?\s*width/i,/deck\s*width/i,/clearing\s*width/i,/working\s*width/i,/mower\s*width/i];
    for(const [k,v] of Object.entries(f.specs)){
      if(patterns.some(rx=>rx.test(k))) return [k,v];
    }
    return null;
  }

  function marketplaceHasSelection(){
    return state.shopMode!=='equipment' ||
      Boolean(clean(state.search) || state.category || state.subcategory ||
        state.power || state.seriesOrEngine || state.width ||
        state.seriesFilter || state.modelFilter || state.packageFilter) ||
      state.brand.size>0 || state.availability.size>0 ||
      state.buyOnline || state.promoOnly ||
      Array.from(state.specFilters.values()).some(values=>values.size>0) ||
      state.hpRanges.size>0 || state.packageComponents.size>0;
  }

  function marketplaceFamilyMatches(f,ignoreBrand=false){
    const queries=String(state.search||'').split(',').map(searchKey).filter(Boolean);
      if(state.category && f.category!==state.category) return false;
      if(state.subcategory && f.subcategory!==state.subcategory) return false;
      if(state.power && f.power!==state.power) return false;

      if(state.seriesFilter || state.modelFilter){
        const variantMatch=(f.variants||[]).some(v=>
          (!state.seriesFilter || clean(v.series)===state.seriesFilter) &&
          (!state.modelFilter || clean(v.model)===state.modelFilter)
        );

        if(!variantMatch) return false;
      }
      if(state.seriesOrEngine){
        const contextGroup=marketplacePowerContextGroup();
        const contextMatch=
          contextGroup &&
          (f.variants||[]).some(v=>
            v.marketplaceRow &&
            clean(v.marketplaceRow[contextGroup.field])===state.seriesOrEngine
          );

        if(!contextMatch) return false;
      }

      if(!ignoreBrand && state.brand.size && !state.brand.has(f.brand)) return false;
      if(state.availability.size){
        const label=availabilityText(f);
        if(!state.availability.has(label)) return false;
      }
      if(state.buyOnline && !f.buyOnline) return false;
      if(state.shopMode==='equipment'){
        const needsMarketplaceVariantMatch=
          (
            state.packageComponents &&
            state.packageComponents.size
          ) ||
          state.promoOnly ||
          state.specFilters.size ||
          state.seriesOrEngine ||
          state.seriesFilter ||
          state.modelFilter;

        if(needsMarketplaceVariantMatch){
          const variantMatch=
            (f.variants||[]).some(v=>
              v.marketplaceRow &&
              marketplaceRowMatches(v.marketplaceRow)
            );

          if(!variantMatch){
            return false;
          }
        }
      }else{
        if(
          state.promoOnly &&
          !(f.variants||[]).some(v=>marketplaceRowHasPromo(v.marketplaceRow))
        ){
          return false;
        }

        for(const [label,values] of state.specFilters){
          if(
            values.size &&
            !values.has(clean(f.specs[label]))
          ){
            return false;
          }
        }
      }
      if(queries.length){
        const hay=searchKey([f.brand,f.model,f.category,f.subcategory,f.power,f.series,...(f.variants||[]).map(v=>v.sku),Object.values(f.specs).join(' ')].join(' '));
        if(!queries.some(query=>hay.includes(query))) return false;
      }
      return true;

  }

  function renderDynamicBrands(){
    const brands=distinct(activeFamilies()
      .filter(f=>marketplaceFamilyMatches(f,true))
      .map(f=>f.brand)).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
    // Keep selected brands visible even when another filter has no matches.
    for(const brand of state.brand){
      if(!brands.includes(brand)) brands.push(brand);
    }
    brands.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
    $('#filter-brand').innerHTML=brands.map(b=>
      '<label><input type="checkbox" data-brand="'+esc(b)+'"'+
      (state.brand.has(b)?' checked':'')+'> <span>'+esc(b)+'</span></label>'
    ).join('');
  }

  function filterFamilies(){
    renderDynamicBrands();
    if(!marketplaceHasSelection()){
      DATA.families=activeFamilies();
      DATA.filtered=[];
      renderCards();renderResultMeta();updateCompareButton();
      syncMarketplaceUrl();
      return;
    }
    DATA.families=activeFamilies();
    const out=DATA.families.filter(f=>marketplaceFamilyMatches(f));
    out.sort((a,b)=>(a.sort===b.sort?0:a.sort-b.sort));
    DATA.filtered=out;
    renderCards();
    renderResultMeta();
    updateCompareButton();
    syncMarketplaceUrl();
  }

  function button(label,value,kind,active){
    return '<button type="button" class="market-chip'+(active?' active':'')+'" data-'+kind+'="'+esc(value)+'">'+esc(label)+'</button>';
  }

  let marketplaceHeaderCacheSource=null;
  const marketplaceHeaderCache=new Map();
  function marketplaceFilterHeaders(kind){
    if(marketplaceHeaderCacheSource!==DATA.products){
      marketplaceHeaderCacheSource=DATA.products;
      marketplaceHeaderCache.clear();
    }
    const key=String(kind||'').trim().toUpperCase();
    if(!marketplaceHeaderCache.has(key)){
      marketplaceHeaderCache.set(key,discoverMarketplaceFilterHeaders(key));
    }
    return marketplaceHeaderCache.get(key);
  }

  function discoverMarketplaceFilterHeaders(kind){
    if(!DATA.products || !DATA.products.length){
      return [];
    }

    const prefix=
      String(kind||'').trim().toUpperCase();

    if(!/^[PBF]$/.test(prefix)){
      return [];
    }

    const found=new Map();
    const pattern=new RegExp(
      '^' + prefix + '(\\d+)-(.+)$',
      'i'
    );

    DATA.products.forEach(row=>{
      Object.keys(row).forEach(header=>{
        const match=
          clean(header).match(pattern);

        if(!match) return;

        const position=Number(match[1]);
        const label=clean(match[2]);

        if(!position || !label) return;

        const key=
          prefix + '|' +
          position + '|' +
          label;

        if(!found.has(key)){
          found.set(key,{
            kind:prefix,
            position,
            label,
            field:header
          });
        }
      });
    });

    return Array.from(found.values()).sort(
      (a,b)=>
        a.position-b.position ||
        a.label.localeCompare(
          b.label,
          undefined,
          {
            numeric:true,
            sensitivity:'base'
          }
        )
    );
  }
  function marketplaceFilterValue(p,group){
    return clean(p[group.field]);
  }

  function marketplacePackageGroups(){
    return marketplaceFilterHeaders('P');
  }

  function marketplacePackageKey(row){
    return marketplacePackageGroups()
      .filter(group=>
        truthy(row && row[group.field])
      )
      .map(group=>group.label)
      .join(' + ');
  }
  function marketplaceRowHasPromo(row){
    return window.WestEndPromotions.matches(row,state.promoView,DATA.promotionFinance||[]);
  }

  async function ensurePromotionPrograms(){
    if(!DATA.promotionProgramsRequest){
      DATA.promotionProgramsRequest=(state.promoView==='zero'?window.WestEndPromotions.loadFinanceCatalog(DATA.products):window.WestEndPromotions.loadProgramCatalog(DATA.products)).then(()=>{DATA.promotionProgramsError=false;}).catch(()=>{DATA.promotionProgramsError=true;});
    }
    await DATA.promotionProgramsRequest;
  }

  function renderPromotionControls(){
    let host=$('#market-promotion-controls');
    if(!host){host=document.createElement('section');host.id='market-promotion-controls';$('.market-shop-nav').before(host);}
    host.hidden=!state.promoOnly;
    if(!state.promoOnly)return;
    window.WestEndPromotions.renderControls(host,state.promoView,value=>{
      location.href=new URL('promotions.html?'+new URLSearchParams({promo:value}),location.href).href;
    });
    const back=document.createElement('a');back.href='promotions.html?promo='+state.promoView;back.textContent='← Promotion categories';back.className='wep-promo-note';host.append(back);
    if(DATA.promotionProgramsError&&['zero','responders','fleet'].includes(state.promoView)){const note=document.createElement('p');note.textContent='Program availability is temporarily unavailable. Please refresh or see store for details.';note.setAttribute('role','status');host.append(note);}
  }

  function marketplaceRowMatches(
    row,
    options={}
  ){
    if(!row || !truthy(row.Active)){
      return false;
    }

    if(
      !options.ignoreCategory && state.category &&
      clean(row.Category)!==state.category
    ){
      return false;
    }

    if(
      !options.ignoreSubcategory &&
      state.subcategory &&
      clean(row.SubCategory)!==state.subcategory
    ){
      return false;
    }

    if(
      !options.ignorePower &&
      state.power &&
      clean(row.PowerType)!==state.power
    ){
      return false;
    }

    if(state.seriesOrEngine && !options.ignoreContext){
      const contextGroup=marketplacePowerContextGroup();
      if(
        !contextGroup ||
        clean(row[contextGroup.field])!==state.seriesOrEngine
      ){
        return false;
      }
    }

    if(
      !options.ignoreSeries &&
      state.seriesFilter &&
      clean(row.Series)!==state.seriesFilter
    ){
      return false;
    }

    if(
      !options.ignoreModel &&
      state.modelFilter &&
      clean(row.Model)!==state.modelFilter
    ){
      return false;
    }

    if(
      !options.ignorePackage &&
      state.packageComponents &&
      state.packageComponents.size
    ){
      for(const field of state.packageComponents){
        if(!truthy(row[field])){
          return false;
        }
      }
    }
    if(
      !options.ignorePromo &&
      state.promoOnly &&
      !marketplaceRowHasPromo(row)
    ){
      return false;
    }

    for(const [field,values] of state.specFilters){
      if(
        field===options.ignoreField ||
        !values ||
        !values.size
      ){
        continue;
      }

      if(!values.has(clean(row[field]))){
        return false;
      }
    }

    return true;
  }

  function marketplacePackageChoices(){
    const values=new Set();

    (DATA.products||[])
      .filter(row=>
        marketplaceRowMatches(
          row,
          {ignorePackage:true}
        )
      )
      .forEach(row=>{
        const key=marketplacePackageKey(row);

        if(key){
          values.add(key);
        }
      });

    return Array.from(values).sort(
      (a,b)=>{
        const ac=a.split(' + ').length;
        const bc=b.split(' + ').length;

        return (
          ac-bc ||
          a.localeCompare(
            b,
            undefined,
            {
              numeric:true,
              sensitivity:'base'
            }
          )
        );
      }
    );
  }

  function marketplacePromoAvailable(){
    return (DATA.products||[]).some(row=>
      marketplaceRowMatches(
        row,
        {
          ignorePromo:true
        }
      ) &&
      marketplaceRowHasPromo(row)
    );
  }
  function marketplaceRowsForGroup(group){
    return (DATA.products||[]).filter(row=>
      marketplaceRowMatches(
        row,
        {
          ignoreField:group.field
        }
      )
    );
  }
  function marketplaceGroups(kind){
    if(
      state.shopMode!=='equipment' ||
      !state.category
    ){
      return [];
    }

    return marketplaceFilterHeaders(kind)
      .map(group=>{
        const values=new Set();

        marketplaceRowsForGroup(group).forEach(p=>{
          const value=marketplaceFilterValue(p,group);
          if(value) values.add(value);
        });

        return Object.assign({},group,{
          values:Array.from(values).sort(
            (a,b)=>a.localeCompare(
              b,
              undefined,
              {numeric:true,sensitivity:'base'}
            )
          )
        });
      })
      .filter(group=>group.values.length);
  }

  function marketplaceSpecGroups(){
    return marketplaceGroups('B');
  }

  function marketplacePowerContextGroups(){
    return marketplaceFilterHeaders('B').filter(group=>
      !/^power\s*type$/i.test(clean(group.label))
    );
  }

  function marketplacePowerContextGroup(){
    const groups=marketplacePowerContextGroups();

    if(!state.power){
      return null;
    }

    return groups.find(group=>
      (DATA.products||[]).some(row=>
        marketplaceRowMatches(
          row,
          {ignoreField:group.field,ignoreContext:true}
        ) &&
        clean(row.PowerType)===state.power &&
        clean(row[group.field])
      )
    ) || null;
  }

  function renderTopFilters(){
    renderPromotionControls();
    const homeButton='<button type="button" class="market-chip market-home" data-market-home aria-label="Return to Marketplace home">Home</button>';
    const tabs=$('#market-shop-tabs');
    tabs.innerHTML='';
    tabs.hidden=true;
    const powerWrap=$('#market-power-wrap');
    const categoryPanel=$('#market-category-panel');
    const contextPanel=$('#market-context-panel');
    const powerHost=$('#market-power');
    const context=$('#market-context');
    const categoryHost=$('#market-categories');
    const widthHost=$('#market-width');

    if(state.shopMode!=='equipment'){
      powerWrap.hidden=true;
      categoryPanel.hidden=true;
      contextPanel.hidden=true;
      context.innerHTML='';
      return;
    }

    tabs.hidden=true;

    powerWrap.hidden=true;
    powerHost.innerHTML='';

    const categories=
      distinct(
        DATA.products.filter(p=>truthy(p.Active)&&(!state.promoOnly||marketplaceRowHasPromo(p))).map(p=>clean(p.Category))
      ).filter(x=>
        !/^batteries|chargers$/i.test(x)
      );

    if(state.category){
      categoryPanel.hidden=true;
      categoryHost.innerHTML='';
    }else{
      categoryPanel.hidden=false;

      categoryHost.innerHTML=
        homeButton +
        '<button type="button" ' +
          'class="market-chip market-all-categories active" ' +
          'data-category="">' +
          'All Categories' +
        '</button>' +

        categories.map(x=>
          button(
            x,
            x,
            'category',
            false
          )
        ).join('');
    }
    const scoped=DATA.equipmentFamilies.filter(f=>
      (!state.category || f.category===state.category) &&
      (!state.subcategory || f.subcategory===state.subcategory) &&
      (!state.power || f.power===state.power)
    );
    const quickSpecs = marketplaceSpecGroups();

    const seriesValues = distinct(
      DATA.products
        .filter(p => marketplaceRowMatches(p,{ignoreSeries:true,ignoreModel:true}))
        .map(p => clean(p.Series))
        .filter(Boolean)
    ).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));

    const modelValues = distinct(
      DATA.products
        .filter(p => marketplaceRowMatches(p,{ignoreModel:true}))
        .map(p => clean(p.Model))
        .filter(Boolean)
    ).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    const powerValues = distinct(
      DATA.products
        .filter(p => marketplaceRowMatches(p,{ignorePower:true}))
        .map(p => clean(p.PowerType))
        .filter(Boolean)
    );
    const powerContextGroup=marketplacePowerContextGroup();

    const powerContextValues =
      state.power && powerContextGroup
        ? distinct(
            DATA.products
              .filter(p=>
                truthy(p.Active) &&
                clean(p.Category)===state.category &&
                (!state.subcategory || clean(p.SubCategory)===state.subcategory) &&
                clean(p.PowerType)===state.power
              )
              .map(p=>clean(p[powerContextGroup.field]))
              .filter(Boolean)
          )
        : [];

    const packageChoices=marketplacePackageChoices();
    const promoAvailable=marketplacePromoAvailable();

    contextPanel.hidden = !(
      state.category ||
      quickSpecs.length ||
      seriesValues.length ||
      modelValues.length ||
      packageChoices.length ||
      promoAvailable ||
      state.promoOnly
    );

    const subcategoryValues = distinct(
      DATA.products
        .filter(p => marketplaceRowMatches(p,{ignoreSubcategory:true}))
        .map(p => clean(p.SubCategory))
        .filter(Boolean)
    );
    const subcategoryHtml = state.category && subcategoryValues.length
      ? '<div class="market-compact-group market-subcategory-nav" style="width:100%;margin-bottom:10px">' +
          '<div class="market-compact-heading">SUBCATEGORIES</div>' +
          '<div class="market-compact-buttons">' +
            button('All Subcategories','','subcategory',!state.subcategory) +
            subcategoryValues.map(value=>button(value,value,'subcategory',state.subcategory===value)).join('') +
          '</div></div>'
      : '';

    const seriesModelHtml =
      '<div class="market-series-model-nav">' +
        '<div class="market-compact-heading">MODELS / SERIES</div>' +
        '<div class="market-compact-buttons">' +
          (state.category ? homeButton : '') +

          '<button type="button" ' +
            'class="market-chip' +
              (
                !state.seriesFilter &&
                !state.modelFilter &&
                !state.seriesModelView
                  ? ' active'
                  : ''
              ) +
            '" data-series-nav="all">' +
            'All Models' +
          '</button>' +

          (
            promoAvailable || state.promoOnly
              ? (
                '<button type="button" ' +
                  'class="market-chip market-promo-chip' +
                    (state.promoOnly ? ' active' : '') +
                  '" data-package-promo="1">' +
                  'Promos' +
                '</button>'
              )
              : ''
          ) +

          '<button type="button" ' +
            'class="market-chip' +
              (
                state.seriesModelView==='series' ||
                state.seriesFilter
                  ? ' active'
                  : ''
              ) +
            '" data-series-nav="series">' +
            'Series' +
          '</button>' +

          '<button type="button" ' +
            'class="market-chip' +
              (
                state.seriesModelView==='model' ||
                state.modelFilter
                  ? ' active'
                  : ''
              ) +
            '" data-series-nav="model">' +
            'Model' +
          '</button>' +

        '</div>' +
      '</div>';

    const seriesModelDetailHtml =
      state.seriesModelView==='series'
        ? (
          '<div class="market-compact-group">' +
            '<div class="market-compact-heading">SERIES</div>' +
            '<div class="market-compact-buttons">' +

              seriesValues.map(value =>
                '<button type="button" ' +
                  'class="market-chip' +
                    (
                      state.seriesFilter===value
                        ? ' active'
                        : ''
                    ) +
                  '" data-series-filter="' +
                    esc(value) +
                  '">' +
                    esc(value) +
                '</button>'
              ).join('') +

            '</div>' +
          '</div>'
        )
        : (
          state.seriesModelView==='model'
            ? (
              '<div class="market-compact-group">' +
                '<div class="market-compact-heading">MODEL</div>' +
                '<div class="market-compact-buttons">' +

                  modelValues.map(value =>
                    '<button type="button" ' +
                      'class="market-chip' +
                        (
                          state.modelFilter===value
                            ? ' active'
                            : ''
                        ) +
                      '" data-model-filter="' +
                        esc(value) +
                      '">' +
                        esc(value) +
                    '</button>'
                  ).join('') +

                '</div>' +
              '</div>'
            )
            : ''
        );
    const packageGroups=
      marketplacePackageGroups()
        .filter(group=>
          (DATA.products||[]).some(row=>
            marketplaceRowMatches(row) &&
            truthy(row[group.field])
          )
        );

    const powerButtons =
      (state.power
        ? button('All Power Types','','power',false)
        : '') +
      powerValues.sort((a,b)=>{const order=['manual','electric','battery','gas','diesel'];const rank=v=>{const i=order.indexOf(String(v).toLowerCase());return i<0?99:i};return rank(a)-rank(b)||a.localeCompare(b)}).map(value=>
        button(
          value,
          value,
          'power',
          state.power===value
        )
      ).join('');
    const powerTypeHtml =
      '<div class="market-compact-group market-power-type">' +
        '<div class="market-compact-heading">POWER TYPE</div>' +
        '<div class="market-compact-buttons">' +
          powerButtons +
        '</div>' +
      '</div>' +

      (
        packageGroups.length
          ? (
            '<div class="market-compact-group market-package-filter" style="margin-top:8px">' +
              '<div class="market-compact-heading">PACKAGES</div>' +
              '<div class="market-compact-buttons">' +
                packageGroups.map(group =>
                  '<button type="button" ' +
                    'class="market-chip' +
                      (
                        state.packageComponents.has(group.field)
                          ? ' active'
                          : ''
                      ) +
                    '" data-package-component="' +
                      esc(group.field) +
                    '">' +
                      esc(group.label) +
                  '</button>'
                ).join('') +
              '</div>' +
            '</div>'
          )
          : ''
      );

    const powerContextHtml =
      state.power && powerContextValues.length
        ? (
          '<div class="market-compact-group market-power-context">' +
            '<div class="market-compact-heading">' +
              esc(powerContextGroup ? powerContextGroup.label : '') +
            '</div>' +
            '<div class="market-compact-buttons">' +
              powerContextValues.map(value=>
                button(
                  value,
                  value,
                  'context',
                  state.seriesOrEngine===value
                )
              ).join('') +
            '</div>' +
          '</div>'
        )
        : '';

    const openBGroup=
      quickSpecs.find(group=>
        group.field===state.openBFilter
      ) || null;

    const narrowSearchHtml =
      quickSpecs.length
        ? (
          '<div class="market-narrow-search">' +

            '<div class="market-compact-heading">' +
              'FILTER BY SPECIFICATIONS' +
            '</div>' +

            '<div class="market-compact-buttons market-b-filter-tabs">' +

              quickSpecs.map(group=>{
                const selected=
                  state.specFilters.get(group.field) ||
                  new Set();

                const count=selected.size;

                return (
                  '<button type="button" ' +
                    'class="market-chip market-b-filter-tab' +
                      (
                        state.openBFilter===group.field
                          ? ' active'
                          : ''
                      ) +
                      (
                        count
                          ? ' has-selection'
                          : ''
                      ) +
                    '" ' +
                    'data-b-filter-open="' +
                      esc(group.field) +
                    '">' +

                    esc(group.label) +

                    (
                      count
                        ? ' (' + count + ')'
                        : ''
                    ) +

                  '</button>'
                );
              }).join('') +

            '</div>' +

            (
              openBGroup
                ? (
                  '<div class="market-b-filter-values">' +

                    '<div class="market-context-label">' +
                      esc(openBGroup.label) +
                    '</div>' +

                    '<div class="market-compact-buttons">' +

                      openBGroup.values.map(value=>{
                        const selected=
                          state.specFilters.get(
                            openBGroup.field
                          ) ||
                          new Set();

                        return (
                          '<button type="button" ' +
                            'class="market-chip' +
                              (
                                selected.has(value)
                                  ? ' active'
                                  : ''
                              ) +
                            '" ' +
                            'data-quick-spec-label="' +
                              esc(openBGroup.field) +
                            '" ' +
                            'data-quick-spec-value="' +
                              esc(value) +
                            '">' +
                              esc(value) +
                          '</button>'
                        );
                      }).join('') +

                    '</div>' +

                  '</div>'
                )
                : ''
            ) +

          '</div>'
        )
        : '';

    const contextHtml =
      '<div class="market-primary-filter-row">' +

        '<div class="market-primary-left">' +
          seriesModelHtml +
        '</div>' +

        '<div class="market-primary-right">' +
          powerTypeHtml +
        '</div>' +

      '</div>' +

      subcategoryHtml +
      seriesModelDetailHtml +

      narrowSearchHtml;

    context.innerHTML=contextHtml;
    const mobileContext=$('#market-mobile-context');
    if(mobileContext) mobileContext.innerHTML=contextHtml;

    widthHost.hidden = true;
    widthHost.innerHTML = '';
  }

  function renderSidebar(){
    DATA.families=activeFamilies();

    renderDynamicBrands();

    $('#filter-availability').innerHTML=
      ['Normally In Stock','Available to Order'].map(x=>
        '<label>' +
          '<input type="checkbox" data-availability="' +
            esc(x) +
          '"> ' +
          '<span>' + esc(x) + '</span>' +
        '</label>'
      ).join('');

    const fGroups=marketplaceGroups('F');

    $('#filter-specs-wrap').hidden=!fGroups.length;

    $('#filter-specs').innerHTML=
      fGroups.map(group=>{
        const selected=
          state.specFilters.get(group.field) ||
          new Set();

        return (
          '<details>' +
            '<summary>' +
              esc(group.label) +
            '</summary>' +
            '<div class="market-checks">' +
              group.values.map(value=>
                '<label>' +
                  '<input type="checkbox" ' +
                    'data-spec-label="' +
                      esc(group.field) +
                    '" ' +
                    'data-spec-value="' +
                      esc(value) +
                    '" ' +
                    (selected.has(value)
                      ? 'checked'
                      : '') +
                  '> ' +
                  '<span>' +
                    esc(value) +
                  '</span>' +
                '</label>'
              ).join('') +
            '</div>' +
          '</details>'
        );
      }).join('');
  }
  function familySpecs(f){
    return Object.entries(f.specs).filter(([,v])=>clean(v)).slice(0,5);
  }

  function relevantVariants(f){
    const variants=(f && f.variants)||[];
    if(state.shopMode!=='equipment') return variants;

    const hasVariantFilters=
      state.packageComponents.size ||
      state.promoOnly ||
      state.specFilters.size ||
      state.seriesFilter ||
      state.modelFilter;

    if(!hasVariantFilters) return variants;

    const matched=variants.filter(v=>
      v.marketplaceRow &&
      marketplaceRowMatches(v.marketplaceRow)
    );

    return matched.length ? matched : variants;
  }

  function activeLocations(){
    return (DATA.locations||[])
      .filter(row=>truthy(row.Active))
      .sort((a,b)=>num(a.SortOrder)-num(b.SortOrder));
  }

  function inventorySkuSet(brand){
    return DATA.inventoryByBrand.get(clean(brand).toUpperCase()) || new Map();
  }

  function familyInventoryStatus(f,variant){
    const variants=Array.isArray(variant) ? variant : (variant ? [variant] : relevantVariants(f));
    const inventory=inventorySkuSet(f.brand);

    const records=distinct(variants.map(v=>skuKey(v.sku)))
      .map(sku=>inventory.get(sku))
      .filter(Boolean);

    const inStock=records.some(x=>x.quantity>0);
    const incoming=!inStock && records.some(x=>x.onOrderQuantity>0);

    const locations=activeLocations().map(location=>{
      const qtyField=clean(location.InventoryQtyField);
      const normallyStocked=variants.some(v=>
        qtyField &&
        v.marketplaceRow &&
        num(v.marketplaceRow[qtyField])>0
      );

      const status=inStock
        ? 'in-stock'
        : incoming
          ? 'incoming'
          : normallyStocked
            ? 'normally-stocked'
            : 'out-of-stock';

      return {
        id:clean(location.LocationID),
        name:clean(location.ShortName)||clean(location.LocationName),
        email:clean(location.Email),
        phone:clean(location.Phone),
        status,
        normallyStocked:status!=='out-of-stock'
      };
    });

    return {
      status:inStock ? 'in-stock' :
        incoming ? 'incoming' :
        locations.some(x=>x.status==='normally-stocked')
          ? 'normally-stocked' : 'out-of-stock',
      normallyStocked:inStock || incoming ||
        locations.some(x=>x.status==='normally-stocked'),
      locations
    };
  }

  function availabilityText(f){
    const status=familyInventoryStatus(f).status;
    return status==='in-stock' ? 'In Stock' :
      status==='incoming' ? 'Incoming' :
      status==='normally-stocked' ? 'Normally Stocked' :
      'Out of Stock - Check Lead Time';
  }

  function smsPhone(value){
    return clean(value).replace(/[^0-9+]/g,'');
  }

  function inventoryMarkup(f,variant,slot){
    const status=familyInventoryStatus(f,variant);
    const skuList=distinct((Array.isArray(variant) ? variant : (variant ? [variant] : relevantVariants(f))).map(v=>v.sku)).join(', ');
    const product=clean(f.brand)+' '+clean(f.model)+(skuList?' (SKU: '+skuList+')':'');
    const inventoryKey=f.key+'|'+clean(slot||'family')+'|'+skuKey(skuList);
    const separator=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';

    const locationRows=status.locations.map(location=>{
      const type=location.status;
      const label=type==='in-stock' ? 'In Stock' :
        type==='incoming' ? 'Incoming' :
        type==='normally-stocked' ? 'Normally Stocked' :
        'Out of Stock - Check Lead Time';

      const available=type!=='out-of-stock';
      const action=type==='out-of-stock'
        ? 'Text to Request Lead Time'
        : 'Text to Confirm Availability';

      const body=type==='out-of-stock'
        ? 'Please provide lead time for '+product+' at '+clean(location.name)+'. I am interested in quantity 1.'
        : 'Please confirm availability of '+product+' at '+clean(location.name)+'. I am interested in quantity 1.';

      const phone=smsPhone(location.phone);
      const heading='<div class="market-inventory-line'+
        (available?'':' market-inventory-order')+'">'+
        esc(location.name)+' - '+esc(label)+'</div>';

      if(!phone) return '<div class="market-inventory-store">'+heading+'</div>';

      const href='sms:'+phone+separator+'body='+encodeURIComponent(body);

      return '<div class="market-inventory-store">'+heading+
        '<a class="market-inventory-contact market-inventory-text-action" aria-label="'+
        esc(action+' at '+location.name)+'" href="'+esc(href)+'">'+
        action+'</a></div>';
    }).join('');

    return '<div class="market-inventory-wrap">'+
      '<button type="button" class="market-inventory-button" data-inventory-toggle="'+
      esc(inventoryKey)+'" aria-expanded="false">Check Inventory</button>'+
      '<div class="market-inventory-popover" data-inventory-popover="'+
      esc(inventoryKey)+'" hidden>'+locationRows+'</div>'+
    '</div>';
  }

  function cartMarkup(f){
    if(selectedStock(f))return '<div class="market-cart-controls"><a class="market-product-details" target="_blank" rel="noopener noreferrer" href="'+esc(paymentSelectionUrl(f))+'">Review In-Stock Unit</a></div>';
    if(isYanmarTractor(f)){
      const v=selectedPriceVariant(f),url='https://westendpower.github.io/yanmar-equipment-configurator/?'+new URLSearchParams({category:f.category,sku:v.sku||''});
      return '<div class="market-cart-controls"><a class="market-product-details" href="'+esc(url)+'">Build &amp; Buy</a></div>';
    }
    return selectedCartMarkup(f);
  }
  function addFamilyToCart(key,buttonEl){
    const f=activeFamilies().find(x=>x.key===key);
    if(!f) return;
    const qty=selectedPriceQuantity(f);
    const v=selectedPriceVariant(f);
    if(!v.buyOnline||!(v.price>0))return;
    if(!v) return;

    let cart=[];
    try{ cart=JSON.parse(localStorage.getItem('wepCart')||'[]'); if(!Array.isArray(cart)) cart=[]; }catch(e){ cart=[]; }

    const addLine=(sku,name,lineQty,price)=>{
      const existing=cart.find(x=>x.sku===sku);
      if(existing) existing.quantity=Math.min(99,(Number(existing.quantity)||0)+lineQty);
      else cart.push({sku,productName:name,description:'',quantity:lineQty,itemPrice:price,shipping:null});
    };

    if(v.recommendedPackage && Array.isArray(v.packageItems)){
      const componentTotal=v.packageItems.reduce((sum,x)=>sum+(Number(x.price)||0)*(Number(x.quantity)||1),0);
      addLine(v.sku,clean(v.marketplaceRow?.Description)||f.model+' — Tool Only',qty,Math.max(0,v.price-componentTotal));
      v.packageItems.forEach(x=>addLine(x.sku,x.name,qty*(Number(x.quantity)||1),Number(x.price)||0));
    }else{
      addLine(v.sku,v.description||f.brand+' '+f.model,qty,v.price);
    }

    localStorage.setItem('wepCart',JSON.stringify(cart));
    updateCartFloat();
    if(buttonEl){
      const old=buttonEl.textContent;
      buttonEl.textContent='Added ✓';
      setTimeout(()=>{buttonEl.textContent=old;},1200);
    }
    track('marketplace_add_to_cart',{sku:v.sku,model:f.model,quantity:qty,value:v.price*qty});
  }

  function packageSummary(v){
    if(clean(v && v.packageIncludes)) return clean(v.packageIncludes);
    const d=clean(v && v.description);
    if(!d) return '';
    const parts=[];
    const batt=d.match(/\b(?:(\d+)\s*[-x]?\s*)?((?:AS|AK|AP|AR)\s*\d+(?:\.\d+)?\s*[A-Z]?)\s*Batter(?:y|ies)?\b/i);
    const charger=d.match(/\b(AL\s*\d+(?:-\d+)?)\s*Charger\b/i) || d.match(/\b(AL\s*\d+(?:-\d+)?)\b/i);
    if(batt){
      const qty=Math.max(1,Number(batt[1])||1);
      const name=batt[2].replace(/\s+/g,' ').trim().toUpperCase();
      parts.push((qty>1?qty+' ':'')+name+' '+(qty>1?'batteries':'battery'));
    }
    if(charger) parts.push(charger[1].replace(/\s+/g,'').toUpperCase()+' charger');
    return parts.length ? parts.join(' and ')+' included' : '';
  }

  function compactBaseVariant(f,current=selectedPriceVariant(f),fixedIdentity=false){
    if(!isCompactTractor(f))return null;
    return compactVariants(f).filter(v=>!compactFlags(v).some(Boolean)&&v.price>0)
      .sort((a,b)=>Number(compactTire(a)!==(fixedIdentity?'R-4':compactTire(current)))-Number(compactTire(b)!==(fixedIdentity?'R-4':compactTire(current)))||a.msrp-b.msrp)[0]||null;
  }
  function compactPriceBoxes(f,current){
    const base=compactBaseVariant(f,current);if(!base)return null;
    const attached=compactFlags(current).some(Boolean),locked=!!selectedStock(f);
    const amount=(v,msrpOnly=false)=>{const offer=msrpOnly?null:promoInfo(v),sale=offer?.type==='sale';return '<span class="pp-prices">'+(sale?'<del>'+money(offer.regular)+'</del>':'')+'<strong>'+money(sale?offer.price:v.msrp||v.price)+'</strong></span>';};
    const control=(v,pressed,extra,label)=>'<button type="button" class="pp-price-select'+extra+'" data-compact-family="'+esc(f.key)+'" data-compact-sku="'+esc(v.sku)+'" aria-pressed="'+pressed+'" '+(locked?'disabled ':'')+'><span>'+esc(label)+'</span>'+amount(v,label==='Package MSRP:')+'</button>';
    return '<div class="pp-box pp-compact-base'+(!attached?' pp-selected':'')+'" data-pp-box="tool">'+control(base,!attached,'',clean(f.brand)+' Base Price:')+'</div>'+
      '<div class="pp-box pp-package pp-compact-package'+(attached?' pp-selected':'')+'" data-pp-box="package">'+control(current,attached,' pp-package-total','Package MSRP:')+stockUnitMarkup(f)+compactHeaderOptions(f)+compactTireMarkup(f)+'</div>';
  }

  function pricePanel(label,v,isPackage,f,variantGroup,hideInventory=false){
    if(!v) return '';
    const selected=selectedPriceVariant(f),group=Array.isArray(variantGroup)?variantGroup:[v];
    if(group.includes(selected))v=selected;
    else if(selected.recommendedPackage||group.some(x=>x.recommendedPackage))v=group.find(x=>skuKey(x.sku)===skuKey(selected.sku))||v;
    if(isCompactTractor(f)){const boxes=compactPriceBoxes(f,v);if(boxes)return boxes;}
    const index=f.variants.indexOf(v),active=v===selected;
    const offer=promoInfo(v),promo=isCompactTractor(f)&&offer?.type!=='sale'?null:offer;
    const regular=promo ? promo.regular : (v.msrp>0 ? v.msrp : v.price);
    const shown=promo?promo.price:isCompactTractor(f)?v.msrp:v.price;
    if(!isPackage&&promo?.type==='sale')label='Sale:';
    label=isPackage?'Package Price':clean(f.brand)+' Base Price:';
    if(isCompactTractor(f))label=compactFlags(v).some(Boolean)?'Package Price':clean(f.brand)+' Base Price:';

    const description=isCompactTractor(f)?'':v.recommendedPackage&&Array.isArray(v.packageItems)
      ?v.packageItems.map(item=>{
        const quantity=Number(item.quantity)||1;
        let name=clean(item.name).replace(/^\d+\s+/,'');
        if(quantity>1)name=name.replace(/\bBattery\b/g,'Batteries').replace(/\bCharger\b/g,'Chargers');
        return quantity+' × '+name;
      }).join(' + ')
      :clean(v.description);
    const descriptionChars=Array.from(description);
    const shownDescription=!v.recommendedPackage&&descriptionChars.length>42?descriptionChars.slice(0,41).join('')+'…':description;
    const savings=isPackage && Number(v.packageSavings||0)>0 && Number(v.packageValue||0)>0
      ? 'Separately '+money(v.packageValue)+' | Save '+money(v.packageSavings)
      : '';
    const base=isCompactTractor(f)?compactVariants(f).filter(x=>!compactFlags(x).some(Boolean)).sort((a,b)=>(compactTire(a)===compactTire(v)?-1:0)-(compactTire(b)===compactTire(v)?-1:0)||a.msrp-b.msrp)[0]:null;
    const baseOffer=base?promoInfo(base):null,baseSale=baseOffer?.type==='sale';
    const baseMarkup=base?'<div class="pp-tractor-base"><span>'+esc(clean(f.brand))+' Base Price:</span><span>'+(baseSale?'<del>'+money(base.msrp)+'</del> ':'')+'<strong>'+money(baseSale?baseOffer.price:base.msrp)+'</strong></span></div>':'';
    return '<div class="market-price-choice'+(isPackage?' market-package-choice':'')+(/Base Price:$/.test(label)?' market-base-choice':'')+'"'+(active?' style="outline:3px solid #238b45;outline-offset:1px"':'')+'>'+
      baseMarkup+stockUnitMarkup(f)+
      compactHeaderOptions(f)+
      compactTireMarkup(f)+
      '<button class="market-price-selection" type="button" '+(selectedStock(f)?'disabled ':'')+'data-price-select="'+esc(f.key)+'" data-price-index="'+index+'" aria-pressed="'+active+'" style="display:block;width:100%;border:0;background:transparent;color:inherit;padding:0;cursor:pointer;text-align:inherit">'+
      '<span class="market-price-heading"><span style="flex:0 1 auto">'+esc(label)+'</span><span class="market-price-pair" style="flex:1 1 auto;justify-content:flex-end">'+
        (promo?'<del>'+money(regular)+'</del>':'')+
        '<strong>'+(shown>0?money(shown):'Pricing Coming Soon')+'</strong>'+
      '</span></span>'+
      (description?'<small class="market-price-description" title="'+esc(description)+'" style="display:block;text-align:center;margin:7px auto;max-width:none;min-width:0;width:100%;font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(shownDescription)+'</small>':'')+
      (promo && promo.type==='rebate'?'<small class="market-promo-price-note">After customer rebate</small>':'')+
      (savings?'<small class="market-package-savings">'+esc(savings)+'</small>':'')+
      '</button>'+
      (hideInventory?'':'<div class="market-price-inventory">'+inventoryMarkup(f,v,isPackage?'package':'unit')+'</div>')+
    '</div>';
  }

  // WEP_SAW_WORKBOOK_ORDER_V1
  function isChainsawFamily(f){return /^chainsaws?$/i.test(clean(f.category));}
  function sawBarSize(v){
    const match=clean(v.description).match(/(\d+(?:\.\d+)?)\s*["\u2033\u201d]/);
    return match ? Number(match[1]) : null;
  }
  function sawConfigurationLabel(v){
    const description=clean(v.description);
    const match=description.match(/\bw\/\s*(\d+(?:\.\d+)?\s*["\u2033\u201d].*)$/i);
    return match ? match[1].replace(/^(\d+(?:\.\d+)?)\s*["\u2033\u201d]/,'$1" bar') : description || clean(v.sku);
  }
  function sawHeaderBars(f){
    if(!isChainsawFamily(f))return '';
    const standardBar=sawBarSize(selectedPriceVariant(f));
    const sizes=[...new Set((f.variants||[]).map(sawBarSize).filter(v=>v!==null && v!==standardBar))].sort((a,b)=>a-b);
    return sizes.length ? ' | Optional bars: '+esc(sizes.map(v=>v+'"').join(', '))+' (prices vary)' : '';
  }
  function familyPriceMarkup(f){
    const v=selectedPriceVariant(f),params=new URLSearchParams({brand:f.brand,sku:v.sku||''});
    const choices=selectedStock(f)?[{label:/kit|package/i.test(v.type)?'Package:':'MSRP:',v,variants:[v],isPackage:/kit|package/i.test(v.type)}]:priceChoices(f);
    const rows=choices.map(choice=>pricePanel(choice.label,choice.v,choice.isPackage,f,choice.variants));
    return '<div class="market-price-lines">'+rows.join('')+
      '<a class="market-product-page-link" href="'+esc('product.html?'+params.toString())+'" style="display:block;text-align:center;margin:8px 0;padding:10px;border:1px solid #176c34;border-radius:8px;font-weight:800;color:#176c34;text-decoration:none">Build &amp; Buy ↗</a><div class="market-build-buy-copy" style="text-align:center;padding:0 4px 6px;color:#46534b;font-size:12px;line-height:1.4"><strong style="display:block;color:#176c34">Your equipment. Your options. Your price.</strong><span>Build your package, compare payment options, and get a quote or buy online.</span></div></div>';
  }

  function offerOverlay(f){
    const promoHit=(f.variants||[]).map(v=>({v,p:promoInfo(v)})).find(x=>x.p);
    const finance=financeOfferData(f);
    if(!promoHit && !finance) return '';

    let promoHtml='';
    if(promoHit){
      const p=promoHit.p;
      const end=p.end ? shortDate(p.end) : '';
      const headline=p.type==='rebate'
        ? money(p.savings).replace(/\.00$/,'')+' Rebate'
        : money(p.savings).replace(/\.00$/,'')+' Savings';
      promoHtml='<div class="market-offer-promo"><strong>'+esc(headline)+'</strong>'+
        (end?'<small>thru '+esc(end)+'</small>':'')+'</div>';
    }

    let financeHtml='';
    if(finance){
      financeHtml='<div class="market-offer-finance"><strong>'+esc(finance.label)+'</strong><small>'+esc(finance.sublabel)+'</small></div>';
    }

    let joiner='';
    if(promoHit && finance){
      const raw=clean(finance.program.RebateCompatible);
      const compatible=raw==='' || truthy(raw);
      joiner='<div class="market-offer-joiner">'+(compatible?'AND':'OR')+'</div>';
    }

    return '<div class="market-offer-row'+((promoHit&&finance)?' market-offer-row-both':'')+'">'+
      promoHtml+joiner+financeHtml+'</div>';
  }


  function catalogBuildUrl(f){
    const url=new URL(paymentSelectionUrl(f));url.pathname=url.pathname.replace(/payment-options(?:\.html)?\/?$/,'product-options.html');return url.href;
  }
  function catalogSpecs(f){const v=selectedPriceVariant(f);return Object.entries(v.specs||f.specs||{}).filter(([,value])=>clean(value)).slice(0,4);}
  function card(f){
    if(window.WestEndMarketplaceCard)return window.WestEndMarketplaceCard.render(f,{selectedPriceVariant,priceChoices,pricePanel,selectedStock,stockHeaderMarkup,sawHeaderBars,cardFinanceMarkup,paymentSelectionUrl,promoInfo,money,state,DATA,currentPrice,inventoryMarkup,selectPackageVariant,refreshSelectedCard,selectedPriceQuantity,updateCartFloat,track,compactBaseVariant});
    const first=selectedPriceVariant(f),specs=catalogSpecs(f),url=catalogBuildUrl(f),heading=clean(first.description)||clean(f.model)||clean(first.sku);
    const productUrl='product.html?'+new URLSearchParams({brand:f.brand,sku:first.sku||''}),promo=isCompactTractor(f)?null:promoInfo(first);
    const msrp=Number(first.msrp||first.price||0),price=promo?.type==='sale'?promo.price:msrp;
    const image=clean(first.marketplaceRow?.ImageURL)||f.image;
    return '<article class="market-card wep-blended-card" data-key="'+esc(f.key)+'">'+
      '<header class="market-card-head"><h3><strong>'+esc(heading)+'</strong><div class="wep-card-sku"><span>SKU: '+esc(first.sku)+sawHeaderBars(f)+'</span>'+stockHeaderMarkup(f)+'</div></h3></header>'+
      '<div class="market-card-body"><section class="market-card-left">'+
        '<div class="market-image-wrap">'+offerOverlay(Object.assign({},f,{variants:[first],price:first.price,series:first.series||f.series}))+
          '<a class="market-image" href="'+esc(productUrl)+'">'+(image?'<img src="'+esc(image)+'" alt="'+esc(heading)+'" loading="lazy">':'<span>Image Coming Soon</span>')+'</a></div>'+
        '<div class="market-detail-actions"><a class="market-product-details" href="'+esc(productUrl)+'">View Details</a>'+
          '<label class="market-product-details market-compare-detail"><input type="checkbox" data-compare="'+esc(f.key)+'" '+(state.compare.has(f.key)?'checked':'')+'> <span>Compare</span></label></div>'+
        '<div class="wep-card-msrp"><span>'+(promo?.type==='sale'?'Sale price':'MSRP')+'</span><strong>'+(price>0?money(price):'Contact Us')+'</strong>'+(promo?.type==='sale'?'<small>MSRP '+money(msrp)+'</small>':'')+'</div>'+
        cardFinanceMarkup(f)+
      '</section><section class="market-buy"><dl class="market-specs">'+specs.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>'+
        inventoryMarkup(f,first,'unit')+stockUnitMarkup(f)+
        '<a class="market-product-page-link wep-card-build" href="'+esc(url)+'">Build &amp; Buy ↗</a>'+
        '<p class="wep-card-build-note">Configure your equipment and review current pricing.</p>'+
      '</section></div></article>';
  }

  // Fit the 42-character description to its actual price-box width.
  function fitPriceDescription(el){
    const width=el.clientWidth;
    if(!width)return;
    const base=el.classList.contains('market-card-title')?20:13;
    el.style.fontSize=base+'px';
    const natural=el.scrollWidth;
    if(natural>width)el.style.fontSize=(Math.floor(base*(width-1)/natural*100)/100)+'px';
  }
  const descriptionResize=typeof ResizeObserver==='function'
    ? new ResizeObserver(entries=>entries.forEach(entry=>fitPriceDescription(entry.target))) : null;
  function fitPriceDescriptions(){
    if(descriptionResize)descriptionResize.disconnect();
    document.querySelectorAll('.market-price-description,.market-card-title').forEach(el=>{
      fitPriceDescription(el);
      if(descriptionResize)descriptionResize.observe(el);
    });
  }
  window.addEventListener('resize',fitPriceDescriptions);

  let cardRenderVersion=0;
  function renderCards(){
    const version=++cardRenderVersion;
    if(!marketplaceHasSelection()){
      $('#market-grid').setAttribute('aria-busy','false');
      $('#market-grid').innerHTML='';
      return;
    }
    const grid=$('#market-grid');
    const families=DATA.filtered.slice();
    const batchSize=24;
    let offset=0;
    grid.setAttribute('aria-busy',families.length>batchSize ? 'true' : 'false');
    if(!families.length){
      grid.innerHTML='<div class="market-empty"><h2>No products match those filters.</h2><p>Clear one or more filters to see additional options.</p></div>';
      return;
    }
    grid.innerHTML=families.slice(0,batchSize).map(card).join('');
    fitPriceDescriptions();
    offset=batchSize;
    function appendBatch(){
      // A changed filter invalidates any pending cards from the previous results.
      if(version!==cardRenderVersion) return;
      grid.insertAdjacentHTML('beforeend',families.slice(offset,offset+batchSize).map(card).join(''));
      fitPriceDescriptions();
      offset+=batchSize;
      if(offset<families.length) setTimeout(appendBatch,16);
      else grid.setAttribute('aria-busy','false');
    }
    if(offset<families.length) setTimeout(appendBatch,16);
  }

  // Universal category view is a separate, catalog-driven page. Keep existing Marketplace filters intact.
  function updateUniversalCategoryLink(){
    const actions=$('.market-results-actions');
    if(!actions) return;
    let link=$('#market-universal-category-link');
    if(!link){
      link=document.createElement('a');
      link.id='market-universal-category-link';
      link.className='market-chip';
      
      link.rel='noopener noreferrer';
      link.style.cssText='display:inline-flex;align-items:center;text-decoration:none;white-space:nowrap';
      link.textContent='Open Category Page ↗';
      actions.prepend(link);
    }
    const brand=state.brand.size===1 ? Array.from(state.brand)[0] : '';
    const category=clean(state.category);
    const hasActive=brand&&category&&DATA.products.some(p=>
      truthy(p.Active)&&clean(p.BrandID||p.BrandName).toLowerCase()===brand.toLowerCase()&&clean(p.Category)===category
    );
    link.hidden=!hasActive;
    if(hasActive)link.href='equipment.html?'+new URLSearchParams({brand,category}).toString();
    else link.removeAttribute('href');
  }


  function renderResultMeta(){
    updateUniversalCategoryLink();
    const showProducts=marketplaceHasSelection();
    const shell=$('#market-app'),refine=$('#market-refine');
    if(shell)shell.classList.toggle('we-market-home',!showProducts);
    if(shell)shell.classList.add('we-filters-expanded');
    $('#market-result-count').parentElement.hidden=!showProducts;
    $('#market-compare-float').style.display=showProducts ? '' : 'none';
    $('#market-result-count').textContent=DATA.filtered.length;

    const bits=[];

    if(state.category) bits.push(state.category);
    if(state.subcategory) bits.push(state.subcategory);
    if(state.power) bits.push(state.power);
    if(state.seriesOrEngine) bits.push(state.seriesOrEngine);
    if(state.width) bits.push(state.width);

    $('#market-result-context').textContent=
      bits.length
        ? ' - '+bits.join(' | ')
        : '';
  }
  function compareTable(all=false){
    const selected=DATA.filtered.filter(f=>state.compare.has(f.key));
    const fams=all?DATA.filtered:(selected.length?selected:DATA.filtered);
    if(!fams.length) return '<p>No products to compare.</p>';
    const labels=[];
    fams.forEach(f=>Object.keys(f.specs).forEach(l=>{if(!labels.includes(l)) labels.push(l);}));
    const rows=['Brand','Power','Series','Starting Price','Availability'].concat(labels.slice(0,10));
    return '<div class="market-compare-scroll"><table><thead><tr><th>Specification</th>'+fams.map(f=>'<th>'+esc(f.brand+' '+f.model)+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(r=>'<tr><th>'+esc(r)+'</th>'+fams.map(f=>{
        let v='';
        if(r==='Brand') v=f.brand;
        else if(r==='Power') v=f.power;
        else if(r==='Series') v=f.series;
        else if(r==='Starting Price'){const chosen=selectedPriceVariant(f);v=chosen.msrp?money(chosen.msrp):'Contact Us';}
        else if(r==='Availability') v=availabilityText(f);
        else v=selectedPriceVariant(f).specs?.[r]||f.specs[r]||'';
        return '<td>'+esc(v)+'</td>';
      }).join('')+'</tr>').join('')+'</tbody></table></div>';
  }

  function updateCompareButton(){
    const b=$('#market-compare-float');
    const n=DATA.filtered.filter(f=>state.compare.has(f.key)).length;
    b.textContent='Compare Selected ('+n+')';
    b.disabled=n<2;
    let all=$('#market-compare-all');if(!all){all=document.createElement('button');all.id='market-compare-all';all.type='button';all.className='market-compare-float';b.after(all);all.addEventListener('click',()=>{$('#market-compare-content').innerHTML=compareTable(true);$('#market-compare-dialog').showModal();});}
    all.textContent='Compare All in View ('+DATA.filtered.length+')';all.disabled=DATA.filtered.length<2;all.hidden=!marketplaceHasSelection();
  }

  function updateCartFloat(){
    let cart=[];
    try{ cart=JSON.parse(localStorage.getItem('wepCart')||'[]'); if(!Array.isArray(cart)) cart=[]; }catch(e){ cart=[]; }
    const n=cart.reduce((sum,x)=>sum+(Number(x.quantity)||0),0);
    const count=$('#market-cart-count');
    if(count) count.textContent=n ? String(n) : '';
  }

  function marketplaceUrlParams(){
    const params=new URLSearchParams();

    if(state.category) params.set('category',state.category);
    if(state.subcategory) params.set('subcategory',state.subcategory);
    if(state.power) params.set('power',state.power);
    if(state.seriesOrEngine) params.set('filter',state.seriesOrEngine);
    if(state.seriesFilter) params.set('series',state.seriesFilter);
    if(state.modelFilter) params.set('model',state.modelFilter);
    if(state.promoOnly) params.set('promo',state.promoView);
    if(state.buyOnline) params.set('online','1');
    if(state.search) params.set('q',state.search);

    if(state.brand.size){
      params.set('brand',Array.from(state.brand).join(','));
    }

    if(state.availability.size){
      params.set('availability',Array.from(state.availability).join(','));
    }

    for(const [field,values] of state.specFilters){for(const value of values)params.append('spec.'+field,value);}
    for(const field of state.packageComponents)params.append('package',field);

    return params;
  }

  function syncMarketplaceUrl(push=false){
    if(applyingUrlState) return;

    const params=marketplaceUrlParams();
    const query=params.toString();
    const next=location.pathname+(query?'?'+query:'')+location.hash;
    const current=location.pathname+location.search+location.hash;

    if(next===current) return;

    history[push?'pushState':'replaceState'](
      {marketplace:true},
      '',
      new URL(next,location.href).href
    );
  }

  function applyMarketplaceUrl(){
    applyingUrlState=true;

    const params=new URLSearchParams(location.search);

    resetMarketplaceSelection();
    state.category=clean(params.get('category'));
    state.subcategory=clean(params.get('subcategory'));
    state.power=clean(params.get('power'));
    state.seriesOrEngine=clean(params.get('filter'));
    state.seriesFilter=clean(params.get('series'));
    state.modelFilter=clean(params.get('model'));
    state.promoOnly=params.has('promo') && (params.get('promo')==='1'||Object.hasOwn(window.WestEndPromotions.views,params.get('promo')));
    state.promoView=Object.hasOwn(window.WestEndPromotions.views,params.get('promo'))?params.get('promo'):'current';
    state.buyOnline=params.get('online')==='1';
    state.search=clean(params.get('q'));

    state.brand.clear();
    clean(params.get('brand'))
      .split(',')
      .map(clean)
      .filter(Boolean)
      .forEach(value=>state.brand.add(value));

    state.availability.clear();
    clean(params.get('availability'))
      .split(',')
      .map(clean)
      .filter(Boolean)
      .forEach(value=>state.availability.add(value));

    for(const [key,value] of params){
      if(key.startsWith('spec.')&&/^[BF]\d+-.+/i.test(key.slice(5))){const field=key.slice(5);if(!state.specFilters.has(field))state.specFilters.set(field,new Set());state.specFilters.get(field).add(value);}
      if(key==='package'&&/^P\d+-.+/i.test(value))state.packageComponents.add(value);
    }

    if($('#market-search')) $('#market-search').value=state.search;
    if($('#filter-buy-online')) $('#filter-buy-online').checked=state.buyOnline;

    applyingUrlState=false;
  }

  function resetContext(){
    state.seriesOrEngine=''; state.width=''; state.specFilters.clear();
    state.hpRanges.clear();state.seriesFilter='';state.modelFilter='';
    state.seriesModelOpen=false;state.seriesModelView='';
    state.packageFilter='';state.packageComponents.clear();state.openBFilter='';
  }

  function track(name,params={}){
    try{
      if(typeof window.gtag==='function') window.gtag('event',name,Object.assign({device_type:matchMedia('(max-width: 800px)').matches?'mobile':'desktop'},params));
      window.dataLayer=window.dataLayer||[];
      window.dataLayer.push(Object.assign({event:name},params));
    }catch(e){}
  }

  function resetMarketplaceSelection(){
    state.shopMode='equipment';
    state.category='';state.subcategory='';state.power='';
    state.seriesOrEngine='';state.width='';
    state.brand.clear();state.availability.clear();
    state.buyOnline=false;state.promoOnly=false;state.promoView='current';state.search='';
    state.specFilters.clear();state.hpRanges.clear();
    state.seriesModelOpen=false;state.seriesModelView='';
    state.seriesFilter='';state.modelFilter='';
    state.packageFilter='';state.packageComponents.clear();state.openBFilter='';
  }

  function returnMarketplaceHome(){
    resetMarketplaceSelection();
    $('#market-search').value='';
    $('#filter-buy-online').checked=false;
    renderTopFilters();renderSidebar();filterFamilies();
    const home=$('[data-market-home]');
    if(home) home.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
    track('marketplace_home');
  }

  function wire(){
    document.addEventListener('toggle',event=>{
      if(!event.target.matches?.('.market-tire-guide'))return;
      const host=event.target.closest('.market-card');
      if(host)host.style.zIndex=event.target.open?'60':'';
    },true);
    document.addEventListener('click',e=>{
      if(window.WestEndEquipmentPackages?.handle(e))return;
      if(window.WestEndPackagePricing?.handle(e))return;
      if(handleStockToggle(e))return;
      if(handleCompactSelection(e))return;
      if(handlePriceSelection(e))return;
      const openFilters=e.target.closest('[data-mobile-filters-open]');
      if(openFilters){
        document.body.classList.add('market-mobile-filters-open');
        return;
      }

      const closeFilters=e.target.closest('[data-mobile-filters-close]');
      if(closeFilters){
        document.body.classList.remove('market-mobile-filters-open');
        return;
      }

      if(e.target.closest('[data-market-home]')){
        returnMarketplaceHome();return;
      }
      const shop=e.target.closest('[data-shop-mode]');
      if(shop){
        state.shopMode=shop.dataset.shopMode||'equipment';
        state.category='';state.subcategory='';state.power='';state.seriesOrEngine='';state.width='';state.specFilters.clear();state.compare.clear();
        renderTopFilters();renderSidebar();filterFamilies();return;
      }
      const promo=e.target.closest('[data-promo-only]');
      if(promo){ state.promoOnly=!state.promoOnly; renderTopFilters(); filterFamilies(); track('marketplace_promos',{active:state.promoOnly}); return; }
      const c=e.target.closest('[data-category]');
      if(c){ state.category=c.dataset.category||''; state.subcategory=''; state.power=''; resetContext(); renderTopFilters(); renderSidebar(); filterFamilies(); track('marketplace_category',{category:state.category||'all'}); return; }
      const s=e.target.closest('[data-subcategory]');
      if(s){
        const v=s.dataset.subcategory||'';
        state.subcategory=state.subcategory===v?'':v;
        renderTopFilters();
        renderSidebar();
        filterFamilies();
        track('marketplace_subcategory',{subcategory:state.subcategory||'all'});
        return;
      }
      const p=e.target.closest('[data-power]');
      if(p){
        const v=p.dataset.power||'';
        state.power=state.power===v?'':v;
        renderTopFilters();
        renderSidebar();
        filterFamilies();
        track('marketplace_power',{power:state.power||'all'});
        return;
      }
      const x=e.target.closest('[data-context]');
      if(x){
        const v=x.dataset.context||'';
        state.seriesOrEngine=state.seriesOrEngine===v?'':v;
        state.seriesFilter='';
        state.modelFilter='';
        state.seriesModelView='';
        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }
      const seriesNav=
        e.target.closest('[data-series-nav]');

      if(seriesNav){
        const view=
          seriesNav.dataset.seriesNav || '';

        if(view==='all'){
          state.seriesFilter='';
          state.modelFilter='';
          state.seriesModelView='';
        }else{
          state.seriesModelView=
            state.seriesModelView===view
              ? ''
              : view;
        }

        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }
      const seriesToggle=
        e.target.closest('[data-series-model-toggle]');

      if(seriesToggle){
        state.seriesModelOpen=!state.seriesModelOpen;
        renderTopFilters();
        return;
      }

      const seriesButton=
        e.target.closest('[data-series-filter]');

      if(seriesButton){
        const value=seriesButton.dataset.seriesFilter||'';

        state.seriesFilter=
          state.seriesFilter===value ? '' : value;



        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }

      const modelButton=
        e.target.closest('[data-model-filter]');

      if(modelButton){
        const value=modelButton.dataset.modelFilter||'';

        state.modelFilter=
          state.modelFilter===value ? '' : value;

        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }
      const packageComponent=
        e.target.closest('[data-package-component]');

      if(packageComponent){
        const field=
          packageComponent.dataset.packageComponent || '';

        if(state.packageComponents.has(field)){
          state.packageComponents.delete(field);
        }else{
          state.packageComponents.add(field);
        }

        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }
      const packageButton=
        e.target.closest('[data-package-filter]');

      if(packageButton){
        const value=
          packageButton.dataset.packageFilter || '';

        state.packageFilter=
          state.packageFilter===value ? '' : value;

        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }
      const packagePromo=
        e.target.closest('[data-package-promo]');

      if(packagePromo){
        state.promoOnly=!state.promoOnly;

        renderTopFilters();
        renderSidebar();
        filterFamilies();

        track(
          'marketplace_promos',
          {active:state.promoOnly}
        );

        return;
      }
      const bFilterOpen=
        e.target.closest('[data-b-filter-open]');

      if(bFilterOpen){
        const field=
          bFilterOpen.dataset.bFilterOpen || '';

        state.openBFilter=
          state.openBFilter===field
            ? ''
            : field;

        renderTopFilters();
        return;
      }
      const quickSpec=
        e.target.closest('[data-quick-spec-label]');

      if(quickSpec){
        const label=
          quickSpec.dataset.quickSpecLabel || '';

        const value=
          quickSpec.dataset.quickSpecValue || '';

        if(!value){
          state.specFilters.delete(label);
          renderTopFilters();
          renderSidebar();
          filterFamilies();
          return;
        }

        if(!state.specFilters.has(label)){
          state.specFilters.set(label,new Set());
        }

        const values=
          state.specFilters.get(label);

        values.has(value)
          ? values.delete(value)
          : values.add(value);

        if(!values.size){
          state.specFilters.delete(label);
        }

        renderTopFilters();
        renderSidebar();
        filterFamilies();
        return;
      }

      const w=e.target.closest('[data-width]');
      if(w){ const v=w.dataset.width||''; state.width=state.width===v?'':v; renderTopFilters(); renderSidebar(); filterFamilies(); return; }
      const inventoryToggle=e.target.closest('[data-inventory-toggle]');
      if(inventoryToggle){
        const key=inventoryToggle.dataset.inventoryToggle||'';
        const popover=document.querySelector('[data-inventory-popover="'+CSS.escape(key)+'"]');
        const opening=popover && popover.hidden;

        $$('[data-inventory-popover]').forEach(x=>{ x.hidden=true; });
        $$('[data-inventory-toggle]').forEach(x=>x.setAttribute('aria-expanded','false'));

        if(popover && opening){
          popover.hidden=false;
          inventoryToggle.setAttribute('aria-expanded','true');
          track('marketplace_check_inventory',{product_key:key});
        }
        return;
      }

      if(!e.target.closest('.market-inventory-wrap')){
        $$('[data-inventory-popover]').forEach(x=>{ x.hidden=true; });
        $$('[data-inventory-toggle]').forEach(x=>x.setAttribute('aria-expanded','false'));
      }

      const add=e.target.closest('[data-add-cart]');
      if(add){ addFamilyToCart(add.dataset.addCart||'',add); return; }
    });

    document.addEventListener('change',e=>{
      const el=e.target;
      if(el.matches('[data-cart-variant]')){
        const f=activeFamilies().find(f=>f.key===el.dataset.cartVariant),index=Number(el.value.slice(el.value.lastIndexOf('|')+1));
        if(f&&selectCardVariant(f,index)){refreshSelectedCard(f);document.querySelector('[data-cart-variant="'+CSS.escape(f.key)+'"]')?.focus({preventScroll:true});}
        return;
      }
      if(el.matches('[data-cart-qty]')){
        const f=activeFamilies().find(f=>f.key===el.dataset.cartQty);
        if(f){if(selectCardVariant(f,cardSelectionFor(f).index,Number(el.value)))refreshSelectedCard(f);else{el.value=String(selectedPriceQuantity(f));el.reportValidity();}}
        return;
      }
      if(el.matches('[data-brand]')){ el.checked?state.brand.add(el.dataset.brand):state.brand.delete(el.dataset.brand); filterFamilies(); }
      else if(el.matches('[data-availability]')){ el.checked?state.availability.add(el.dataset.availability):state.availability.delete(el.dataset.availability); filterFamilies(); }
      else if(el.id==='filter-buy-online'){ state.buyOnline=el.checked; filterFamilies(); }
      else if(el.matches('[data-compare]')){
        const key=el.dataset.compare||'';
        el.checked ? state.compare.add(key) : state.compare.delete(key);
        updateCompareButton();
      }
      else if(el.matches('[data-spec-label]')){
        const l=el.dataset.specLabel;
        const v=el.dataset.specValue;

        if(!state.specFilters.has(l)){
          state.specFilters.set(l,new Set());
        }

        el.checked
          ? state.specFilters.get(l).add(v)
          : state.specFilters.get(l).delete(v);

        if(!state.specFilters.get(l).size){
          state.specFilters.delete(l);
        }

        renderTopFilters();
        renderSidebar();
        filterFamilies();
      }
    });

    document.addEventListener('input',e=>{
      const el=e.target;if(!el.matches('[data-cart-qty]'))return;
      const f=activeFamilies().find(f=>f.key===el.dataset.cartQty);
      if(f)selectCardVariant(f,cardSelectionFor(f).index,Number(el.value));
    });
    $('#market-search').addEventListener('input',e=>{ state.search=e.target.value; filterFamilies(); });
    $('#market-clear').addEventListener('click',()=>{
      resetMarketplaceSelection();
      $('#market-search').value=''; $('#filter-buy-online').checked=false;
      renderTopFilters();renderSidebar();filterFamilies();
      track('marketplace_clear_filters');
    });

    $('#market-compare-float').addEventListener('click',()=>{
      $('#market-compare-content').innerHTML=compareTable();
      $('#market-compare-dialog').showModal();
      track('marketplace_compare',{visible_products:DATA.filtered.length});
    });
    $('#market-compare-close').addEventListener('click',()=>$('#market-compare-dialog').close());
  }

  function installAnalytics(settings){
    const ga=clean(settings.GA4MeasurementID), gtm=clean(settings.GoogleTagManagerID);
    if(gtm){
      window.dataLayer=window.dataLayer||[];
      const s=document.createElement('script');
      s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(gtm);
      document.head.appendChild(s);
    }
    if(ga){
      const s=document.createElement('script');
      s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ga);
      document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[];
      window.gtag=window.gtag||function(){dataLayer.push(arguments);};
      gtag('js',new Date());gtag('config',ga);
    }
  }

  function applyDealer(settings){
    const name=clean(settings.DealerName)||clean(settings.DefaultSEOName)||'Equipment Dealer';
    $('#market-dealer-name').textContent=name;
    const logo=clean(settings.DealerLogoURL);
    // The approved header embeds the dealer logo for reliable display.
    document.title=(clean(settings.DefaultSEOName)||name)+' | Shop Equipment';
    const meta=$('meta[name="description"]');
    if(meta) meta.content='Shop and compare equipment by category, brand, power source, availability and specifications at '+name+'.';
    installAnalytics(settings);
  }

  function activeBrand(){
    const brandId=String(window.WESTEND_ACTIVE_BRAND||'STIHL').trim().toUpperCase();
    const brands=window.WESTEND_BRANDS||{};
    return brands[brandId]||brands.STIHL||{
      id:'STIHL',
      name:'STIHL',
      dataRoot:'brands/stihl/data/'
    };
  }

  function brandDataPath(fileName){
    const profile=activeBrand();
    const root=String(profile.dataRoot||'brands/stihl/data/').replace(/\/?$/,'/');
    return root+fileName;
  }
  function marketplaceBrandProfiles(){
    const brands=window.WESTEND_BRANDS||{};

    if(Array.isArray(window.WESTEND_PUBLISHED_BRANDS)) return window.WESTEND_PUBLISHED_BRANDS;
    return Object.values(brands).filter(Boolean);
  }

  async function loadMarketplaceProducts(){
    const profiles=marketplaceBrandProfiles();

    const lists=await Promise.all(
      profiles.map(profile=>{
        const root=String(profile.dataRoot||'').replace(/\/?$/,'/');
        return csv(root+'products.csv');
      })
    );

    return lists.flat();
  }
  function unpackMarketplaceTable(table){
    if(!table || !Array.isArray(table.headers) || !Array.isArray(table.rows) ||
       !['dense','sparse'].includes(table.encoding) ||
       table.headers.some(h=>typeof h!=='string' || !h) ||
       new Set(table.headers).size!==table.headers.length){
      throw new Error('Invalid combined catalog table');
    }
    return table.rows.map(values=>{
      if(!Array.isArray(values))throw new Error('Invalid catalog row');
      const row=Object.fromEntries(table.headers.map(h=>[h,'']));
      if(table.encoding==='dense'){
        if(values.length!==table.headers.length || values.some(v=>typeof v!=='string'))throw new Error('Invalid dense catalog row');
        table.headers.forEach((h,i)=>row[h]=values[i]);
      }else{
        if(values.length%2)throw new Error('Invalid sparse catalog row');
        const seen=new Set();
        for(let i=0;i<values.length;i+=2){
          const index=values[i],value=values[i+1];
          if(!Number.isInteger(index)||index<0||index>=table.headers.length||seen.has(index)||typeof value!=='string')throw new Error('Invalid sparse catalog cell');
          seen.add(index);row[table.headers[index]]=value;
        }
      }
      return row;
    });
  }

  async function loadMarketplaceCatalog(){
    try{
      const preload=document.querySelector('link[data-marketplace-catalog]');
      const url=preload ? preload.getAttribute('href') : 'data/marketplace-catalog.json';
      const response=await fetch(url,{cache:'no-cache',credentials:'same-origin'});
      if(!response.ok)throw new Error('Combined catalog HTTP '+response.status);
      const bundle=await response.json();
      const expected=Array.isArray(bundle.brands)?bundle.brands:[];
      if(!expected.length || new Set(expected).size!==expected.length || expected.some(id=>typeof id!=='string'||!id.trim()))throw new Error('Invalid published brand list');
      if(bundle.schema!==1 || JSON.stringify(bundle.brands)!==JSON.stringify(expected) ||
         bundle.componentBrand!=="STIHL" ||
         !Array.isArray(bundle.productSources) || bundle.productSources.length!==expected.length ||
         bundle.productSources.some((table,i)=>table.brand!==expected[i]) || !bundle.tables){
        throw new Error('Combined catalog does not match this Marketplace');
      }
      DATA.componentSources=Object.fromEntries((bundle.componentSources||[]).map(source=>[clean(source.brand).toUpperCase(),Object.fromEntries(['batteries','chargers','compatibility','packages','requirements','attachments','accessories','parts'].map(name=>[name,unpackMarketplaceTable(source[name])]))]));
      DATA.promotionFinance=(bundle.financeSources||[]).flatMap(source=>unpackMarketplaceTable(source).map(row=>({...row,BrandID:source.brand})));
      const products=bundle.productSources.flatMap(unpackMarketplaceTable);
      if(!products.length)throw new Error('Combined catalog has no products');
      window.WESTEND_PUBLISHED_BRANDS=bundle.productSources.map(table=>{
        const id=clean(table.brand).toUpperCase();
        return (window.WESTEND_BRANDS||{})[id] || {id,name:clean(table.brand),dataRoot:''};
      }).filter(profile=>products.some(p=>truthy(p.Active)&&clean(p.BrandID||p.BrandName).toUpperCase()===profile.id.toUpperCase()));
      window.dispatchEvent(new Event('westend:catalog-ready'));
      const result=[products,...['batteries','chargers','compatibility','financePrograms','settingsRows'].map(name=>unpackMarketplaceTable(bundle.tables[name]))];
      window.WESTEND_MARKETPLACE_CATALOG_SOURCE='combined';
      return result;
    }catch(error){
      console.warn('Combined catalog unavailable; loading original CSV files.',error);
      window.WESTEND_MARKETPLACE_CATALOG_SOURCE='csv-fallback';
      return Promise.all([
        loadMarketplaceProducts(),
        csv('brands/stihl/data/batteries.csv'),
        csv('brands/stihl/data/chargers.csv'),
        csv('brands/stihl/data/compatibility-runtime.csv'),
        csv('brands/stihl/data/finance-programs.csv'),
        csv('data/dealer-settings.csv')
      ]);
    }
  }

  async function loadMarketplaceLocations(){
    try{
      return await csv('data/locations.csv');
    }catch(error){
      console.warn('Marketplace locations unavailable.',error);
      return [];
    }
  }

  async function loadInventoryAvailability(brands){
    const results=await Promise.all(
      brands.map(async brand=>{
        try{
          const response=await fetch(MARKETPLACE_API+'/inventory-availability',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({brandId:brand})
          });
          if(!response.ok) throw new Error('HTTP '+response.status);

          const data=await response.json();
          const inventory=new Map();inventory.loaded=true;

          for(const item of (Array.isArray(data.availability)?data.availability:[])){
            const sku=skuKey(item.sku);
            if(!sku) continue;
            inventory.set(sku,{
              quantity:Math.max(0,num(item.quantity)),
              onOrderQuantity:Math.max(0,num(item.onOrderQuantity)),
              selections:Array.isArray(item.selections)?item.selections:[]
            });
          }

          return [brand,inventory];
        }catch(error){
          console.warn('Inventory availability unavailable for '+brand,error);
          return [brand,new Map()];
        }
      })
    );

    DATA.inventoryByBrand=new Map(results);
  }
  async function init(){
    if(location.search==='?promo=1'){location.replace(new URL('promotions.html',location.href));return;}
    try{
      const [catalog,locations]=await Promise.all([
        loadMarketplaceCatalog(),
        loadMarketplaceLocations()
      ]);
      const [products,batteries,chargers,compatibility,financePrograms,settingsRows]=catalog;
      DATA.products=products;
      if(['zero','responders','fleet'].includes(new URLSearchParams(location.search).get('promo')))await ensurePromotionPrograms();
      DATA.batteries=batteries;
      DATA.chargers=chargers;
      DATA.compatibility=compatibility;
      DATA.financePrograms=financePrograms;
      if(!DATA.promotionFinance?.length){
        DATA.promotionFinance=(await Promise.all(marketplaceBrandProfiles().map(async profile=>{const brand=clean(profile.id).toUpperCase();try{return (await csv('brands/'+brand.toLowerCase()+'/data/finance-programs.csv')).map(row=>({...row,BrandID:brand}));}catch{return [];}}))).flat();
      }
      DATA.batterySystems=new Set(
        batteries.filter(x=>truthy(x.Active)).map(x=>clean(x.BatteryID).match(/^[A-Za-z]+/)?.[0]||'').filter(Boolean).map(x=>x.toUpperCase())
      );
      if(!Object.keys(DATA.componentSources||{}).length){
        const batteryBrands=new Set(products.filter(row=>/battery/i.test(clean(row.PowerType))).map(row=>clean(row.BrandID).toUpperCase()));
        const profiles=marketplaceBrandProfiles().filter(profile=>batteryBrands.has(clean(profile.id).toUpperCase()));
        DATA.componentSources=Object.fromEntries(await Promise.all(profiles.map(async profile=>{
          const brand=clean(profile.id).toUpperCase(),base='brands/'+brand.toLowerCase()+'/data/';
          const names=['batteries','chargers','compatibility','packages','requirements','attachments','accessories','parts'];
          const existing={batteries,chargers,compatibility};
          const rows=await Promise.all(names.map(name=>brand==='STIHL'&&Object.hasOwn(existing,name)?Promise.resolve(existing[name]):csv(base+(name==='compatibility'?'compatibility-runtime':name==='requirements'?'battery-requirements':name)+'.csv').catch(()=>[])));
          return [brand,Object.fromEntries(names.map((name,i)=>[name,rows[i]]))];
        })));
      }
      DATA.settings=settingsRows[0]||{};
      DATA.locations=locations;
      await loadInventoryAvailability(
        marketplaceBrandProfiles().map(profile=>clean(profile.id).toUpperCase())
      );
      DATA.equipmentFamilies=enrichFactoryPackageSavings(enrichRecommendedPackages(groupFamilies(products)));
      DATA.batteryFamilies=groupComponents(batteries,'battery');
      DATA.chargerFamilies=groupComponents(chargers,'charger');
      DATA.families=activeFamilies();
      DATA.filtered=DATA.families.slice();
      applyDealer(DATA.settings);
      applyMarketplaceUrl();
      renderTopFilters(); renderSidebar(); filterFamilies(); wire(); updateCartFloat();
      $('#market-loading').hidden=true; $('#market-app').hidden=false;
      window.WESTEND_MARKETPLACE_READY_MS=Math.round(performance.now());
    }catch(err){
      console.error(err);
      $('#market-loading').innerHTML='<strong>Unable to load product data.</strong><br>'+esc(err.message||err);
    }
  }

  window.addEventListener('popstate',()=>{
    applyMarketplaceUrl();
    renderTopFilters();
    renderSidebar();
    filterFamilies();
  });

  document.addEventListener('DOMContentLoaded',init);
})();

// WEP_NAVIGATION_REPAIR_V1

// WEP_NAVIGATION_LAYOUT_V1

// WEP_ROUTE_FIXES_V1

// WEP_ONE_SKU_PER_CARD_V1

// WEP_SORT_ORDER_FIRST_V1

// WEP_POWER_THEN_SORTORDER_V1

// Build & Buy shares the workbook-backed run / charge chart with equipment cards.
(function(){
 const css=document.createElement('link');css.rel='stylesheet';css.href='universal/build-buy.css';document.head.append(css);
 let ready;
 function tools(){if(window.WEPBuildBuy)return Promise.resolve(window.WEPBuildBuy);if(!ready)ready=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='universal/build-buy-tools.js';s.onload=()=>resolve(window.WEPBuildBuy);s.onerror=()=>{ready=null;reject(Error('Chart could not be loaded'));};document.head.append(s);});return ready;}
 document.addEventListener('click',async e=>{const a=e.target.closest('[data-wep-runtime-brand]');if(!a||window.WEPBuildBuy)return;e.preventDefault();e.stopImmediatePropagation();try{const api=await tools();api.openChart(await api.load(a.dataset.wepRuntimeBrand,a.dataset.wepRuntimeSku));}catch(error){alert(error.message);}},true);
 tools().then(api=>{const observer=new MutationObserver(()=>decorate(api));observer.observe(document.body,{childList:true,subtree:true});decorate(api);}).catch(()=>{});
 function decorate(api){document.querySelectorAll('[data-wep-integrated]').forEach(el=>{if(el.dataset.wepReady)return;el.dataset.wepReady='1';try{const row=JSON.parse(el.dataset.wepIntegrated);el.innerHTML=api.costMarkup(row);}catch{}});}
})();

// WEP_BUILD_BUY_V1
