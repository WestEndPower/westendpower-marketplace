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

  function groupFamilies(rows){
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
        model ||
        clean(p.SKU);

      const key=(brand+'|'+familyModel).toUpperCase();
      const rowSort=num(p.SortOrder)||999999;

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
        sku:clean(p.SKU),
        description:clean(p.Description),
        series:clean(p.Series),
        model:clean(p.Model),
        marketplaceRow:p,
        specs:variantSpecs,
        type:clean(p.ProductType),
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
    }).sort((a,b)=>{
      const categoryCompare=
        clean(a.category).localeCompare(
          clean(b.category),
          undefined,
          {numeric:true,sensitivity:'base'}
        );

      if(categoryCompare) return categoryCompare;

      const ap=Number(a.price||0);
      const bp=Number(b.price||0);

      if((ap>0)!==(bp>0)){
        return ap>0 ? -1 : 1;
      }

      if(ap>0 && bp>0 && ap!==bp){
        return ap-bp;
      }

      const brandCompare=
        clean(a.brand).localeCompare(
          clean(b.brand),
          undefined,
          {numeric:true,sensitivity:'base'}
        );

      if(brandCompare) return brandCompare;

      if(a.sort!==b.sort){
        return a.sort-b.sort;
      }

      return clean(a.model).localeCompare(
        clean(b.model),
        undefined,
        {numeric:true,sensitivity:'base'}
      );
    });
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
        sort:num(p.SortOrder)||index+1,
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
    }).sort((a,b)=>
      a.category.localeCompare(
        b.category,
        undefined,
        {numeric:true,sensitivity:'base'}
      ) ||
      a.price-b.price ||
      a.brand.localeCompare(
        b.brand,
        undefined,
        {numeric:true,sensitivity:'base'}
      ) ||
      a.sort-b.sort ||
      a.model.localeCompare(
        b.model,
        undefined,
        {numeric:true,sensitivity:'base'}
      )
    );
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
    const sale=num(row && row.SalePrice), msrp=num(row && row.MSRP);
    return sale>0 ? sale : msrp;
  }

  function componentName(row){
    return clean(row && (row.Model||row.BatteryID||row.ChargerID||row.ChargerName||row.Description||row.SKU))
      .replace(/\s+/g,' ').trim();
  }

  function enrichRecommendedPackages(families){
    const compatBySku=new Map(DATA.compatibility.map(x=>[clean(x.ToolSKU).toUpperCase(),x]));
    const batteryById=new Map(DATA.batteries.map(x=>[clean(x.BatteryID).toUpperCase(),x]));
    const chargerById=new Map(DATA.chargers.map(x=>[clean(x.ChargerID).toUpperCase(),x]));

    families.forEach(f=>{
      if(!/battery/i.test(f.power)) return;
      const hasKit=f.variants.some(v=>/kit|package/i.test(v.type));
      if(hasKit) return;
      const tool=f.variants.find(v=>!/kit|package/i.test(v.type));
      if(!tool || !(tool.price>0)) return;
      const compat=compatBySku.get(clean(tool.sku).toUpperCase());
      if(!compat) return;

      const batteryId=clean(compat.RecommendedBatteryID1).toUpperCase();
      const chargerId=clean(compat.RecommendedChargerID1).toUpperCase();
      const battery=batteryById.get(batteryId);
      const charger=chargerById.get(chargerId);
      if(!battery || !charger) return;

      const batteryPrice=currentPrice(battery), chargerPrice=currentPrice(charger);
      if(!(batteryPrice>0 && chargerPrice>0)) return;

      const batteryQty=Math.max(1,num(compat.RecommendedBatteryQty1)||1);
      const chargerQty=Math.max(1,num(compat.RecommendedChargerQty1)||1);
      const batteryLabel=(clean(battery.BatteryID)||componentName(battery))+' '+(batteryQty>1?'Batteries':'Battery');
      const chargerLabel=(clean(charger.ChargerID)||componentName(charger))+' '+(chargerQty>1?'Chargers':'Charger');

      f.variants.push({
        sku:tool.sku,
        description:tool.description,
        type:'Package',
        msrp:0,
        sale:0,
        price:tool.price+(batteryPrice*batteryQty)+(chargerPrice*chargerQty),
        qtyDanbury:tool.qtyDanbury,
        qtyNewMilford:tool.qtyNewMilford,
        buyOnline:tool.buyOnline,
        localDelivery:tool.localDelivery,
        assembly:tool.assembly,
        productUrl:tool.productUrl,
        recommendedPackage:true,
        packageItems:[
          {sku:clean(battery.SKU),name:batteryLabel,quantity:batteryQty,price:batteryPrice},
          {sku:clean(charger.SKU),name:chargerLabel,quantity:chargerQty,price:chargerPrice}
        ],
        packageIncludes:[
          (batteryQty>1?batteryQty+' ':'')+batteryLabel,
          (chargerQty>1?chargerQty+' ':'')+chargerLabel
        ].join(' and ')+' included'
      });
    });
    return families;
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
    const aprLabel=apr===0 ? '0%' : apr.toFixed(2).replace(/\.00$/,'')+'%';
    return {
      program:p,
      label:aprLabel+' for '+clean(p.TermMonths),
      sublabel:'Month Financing'
    };
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
    const q=searchKey(state.search);
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
          !(f.variants||[]).some(v=>promoInfo(v))
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
      if(q){
        const hay=searchKey([f.brand,f.model,f.category,f.subcategory,f.power,f.series,Object.values(f.specs).join(' ')].join(' '));
        if(!hay.includes(q)) return false;
      }
      return true;

  }

  function renderDynamicBrands(){
    const brands=distinct(activeFamilies()
      .filter(f=>marketplaceFamilyMatches(f,true))
      .map(f=>f.brand)).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
    const eligible=new Set(brands);
    for(const brand of state.brand){
      if(!eligible.has(brand))state.brand.delete(brand);
    }
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
      return;
    }
    DATA.families=activeFamilies();
    const out=DATA.families.filter(f=>marketplaceFamilyMatches(f));
    DATA.filtered=out;
    renderCards();
    renderResultMeta();
    updateCompareButton();
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
    if(!row) return false;

    const msrp=num(row.MSRP);
    const sale=num(row.SalePrice);
    const rebate=num(row.RebateToCustomer);

    const saleActive=
      sale>0 &&
      msrp>0 &&
      sale<msrp &&
      dateActive(
        row.SaleStartDate,
        row.SaleEndDate
      );

    const rebateActive=
      rebate>0 &&
      msrp>0 &&
      rebate<msrp &&
      dateActive(
        row.RebateStartDate,
        row.RebateEndDate
      );

    return saleActive || rebateActive;
  }

  function marketplaceRowMatches(
    row,
    options={}
  ){
    if(!row || !truthy(row.Active)){
      return false;
    }

    if(
      state.category &&
      clean(row.Category)!==state.category
    ){
      return false;
    }

    if(
      state.subcategory &&
      clean(row.SubCategory)!==state.subcategory
    ){
      return false;
    }

    if(
      state.power &&
      clean(row.PowerType)!==state.power
    ){
      return false;
    }

    if(state.seriesOrEngine){
      const contextGroup=marketplacePowerContextGroup();
      if(
        !contextGroup ||
        clean(row[contextGroup.field])!==state.seriesOrEngine
      ){
        return false;
      }
    }

    if(
      state.seriesFilter &&
      clean(row.Series)!==state.seriesFilter
    ){
      return false;
    }

    if(
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
          {ignoreField:group.field}
        ) &&
        clean(row.PowerType)===state.power &&
        clean(row[group.field])
      )
    ) || null;
  }

  function renderTopFilters(){
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
        DATA.products.filter(p=>truthy(p.Active)).map(p=>clean(p.Category))
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
        .filter(p =>
          truthy(p.Active) &&
          clean(p.Category)===state.category &&
          (!state.subcategory || clean(p.SubCategory)===state.subcategory) &&
          (!state.power || clean(p.PowerType)===state.power)
        )
        .map(p => clean(p.Series))
        .filter(Boolean)
    ).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));

    const modelValues = distinct(
      DATA.products
        .filter(p =>
          truthy(p.Active) &&
          clean(p.Category)===state.category &&
          (!state.subcategory || clean(p.SubCategory)===state.subcategory) &&
          (!state.power || clean(p.PowerType)===state.power) &&
          (!state.seriesFilter || clean(p.Series)===state.seriesFilter)
        )
        .map(p => clean(p.Model))
        .filter(Boolean)
    ).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));

    const powerValues = distinct(
      DATA.products
        .filter(p=>
          truthy(p.Active) &&
          clean(p.Category)===state.category &&
          (!state.subcategory || clean(p.SubCategory)===state.subcategory)
        )
        .map(p=>clean(p.PowerType))
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
      DATA.products.filter(p=>
        truthy(p.Active) && clean(p.Category)===state.category
      ).map(p=>clean(p.SubCategory)).filter(Boolean)
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

    const powerButtons = state.power
      ? [
          button('All Power Types','','power',false),
          button(state.power,state.power,'power',true)
        ].join('')
      : powerValues.map(value=>
          button(
            value,
            value,
            'power',
            false
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
              'NARROW SEARCH RESULTS' +
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

      powerContextHtml +
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
    return DATA.inventoryByBrand.get(clean(brand).toUpperCase()) || new Set();
  }

  function familyInventoryStatus(f,variant){
    const variants=variant ? [variant] : relevantVariants(f);
    const shared=inventorySkuSet(f.brand);
    const sharedHit=variants.some(v=>shared.has(skuKey(v.sku)));

    const locations=activeLocations().map(location=>{
      const qtyField=clean(location.InventoryQtyField);
      const normallyStocked=
        sharedHit ||
        variants.some(v=>
          qtyField &&
          v.marketplaceRow &&
          num(v.marketplaceRow[qtyField])>0
        );

      return {
        id:clean(location.LocationID),
        name:clean(location.ShortName)||clean(location.LocationName),
        email:clean(location.Email),
        phone:clean(location.Phone),
        normallyStocked
      };
    });

    return {
      normallyStocked:locations.some(x=>x.normallyStocked),
      locations
    };
  }

  function availabilityText(f){
    return familyInventoryStatus(f).normallyStocked
      ? 'Normally In Stock'
      : 'Available to Order';
  }

  function smsPhone(value){
    return clean(value).replace(/[^0-9+]/g,'');
  }

  function inventoryMarkup(f,variant,slot){
    const status=familyInventoryStatus(f,variant);
    const skuList=distinct((variant ? [variant] : relevantVariants(f)).map(v=>v.sku)).join(', ');
    const body='I would like to request lead time for '+clean(f.brand)+' '+clean(f.model)+(skuList?' (SKU: '+skuList+')':'')+'.';
    const inventoryKey=f.key+'|'+clean(slot||'family')+'|'+skuKey(skuList);

    const locationRows=status.locations.map(location=>{
      if(location.normallyStocked){
        return '<div class="market-inventory-line"><span aria-hidden="true">✓</span> '+esc(location.name)+' - Normally In Stock</div>';
      }

      const phone=smsPhone(location.phone);
      if(!phone){
        return '<div class="market-inventory-line market-inventory-order">'+esc(location.name)+' - Request Lead Time</div>';
      }

      const href='sms:'+phone+'?body='+encodeURIComponent(body);
      return '<a class="market-inventory-contact market-inventory-location-contact" href="'+esc(href)+'">'+esc(location.name)+' - Request Lead Time</a>';
    }).join('');

    return '<div class="market-inventory-wrap">'+
      '<button type="button" class="market-inventory-button" data-inventory-toggle="'+esc(inventoryKey)+'" aria-expanded="false">Check Inventory</button>'+
      '<div class="market-inventory-popover" data-inventory-popover="'+esc(inventoryKey)+'" hidden>'+
        locationRows+
      '</div>'+
    '</div>';
  }

  function cartMarkup(f){
    const eligible=f.variants.filter(v=>v.buyOnline && v.price>0);
    if(!eligible.length) return '';
    const options=eligible.map((v,i)=>'<option value="'+esc(v.sku+'|'+f.variants.indexOf(v))+'">'+esc((/kit|package/i.test(v.type)?'Package':'Unit')+' â€” '+money(v.price))+'</option>').join('');
    return '<div class="market-cart-controls">'+
      '<select data-cart-variant="'+esc(f.key)+'" aria-label="Choose Purchase Option"><option value="" selected disabled>Choose Purchase Option</option>'+options+'</select>'+
      '<input data-cart-qty="'+esc(f.key)+'" type="number" min="1" max="99" value="1" aria-label="Quantity">'+
      '<button type="button" data-add-cart="'+esc(f.key)+'">Add to Cart</button>'+
    '</div>';
  }

  function addFamilyToCart(key,buttonEl){
    const f=activeFamilies().find(x=>x.key===key);
    if(!f) return;
    const select=document.querySelector('[data-cart-variant="'+CSS.escape(key)+'"]');
    const qtyInput=document.querySelector('[data-cart-qty="'+CSS.escape(key)+'"]');
    const selected=select ? select.value : '';
    const qty=Math.max(1,Math.min(99,parseInt(qtyInput && qtyInput.value,10)||1));
    const v=f.variants.find((x,i)=>(x.sku+'|'+i)===selected && x.buyOnline && x.price>0);
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
      addLine(v.sku,f.model+' â€” Unit',qty,Math.max(0,v.price-componentTotal));
      v.packageItems.forEach(x=>addLine(x.sku,x.name,qty*(Number(x.quantity)||1),Number(x.price)||0));
    }else{
      addLine(v.sku,v.description||f.brand+' '+f.model,qty,v.price);
    }

    localStorage.setItem('wepCart',JSON.stringify(cart));
    updateCartFloat();
    if(buttonEl){
      const old=buttonEl.textContent;
      buttonEl.textContent='Added âœ“';
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

  function pricePanel(label,v,isPackage,f){
    if(!v) return '';
    const promo=promoInfo(v);
    const regular=promo ? promo.regular : (v.msrp>0 ? v.msrp : v.price);
    const shown=promo ? promo.price : v.price;
    const include=isPackage ? packageSummary(v) : '';
    const savings=isPackage && Number(v.packageSavings||0)>0 && Number(v.packageValue||0)>0
      ? 'Package Value '+money(v.packageValue)+' Â· Save '+money(v.packageSavings)
      : '';
    return '<div class="market-price-choice'+(isPackage?' market-package-choice':'')+'">'+
      '<div class="market-price-heading"><span>'+esc(label)+'</span><span class="market-price-pair">'+
        (promo?'<del>'+money(regular)+'</del>':'')+
        '<strong>'+(shown>0?money(shown):'Pricing Coming Soon')+'</strong>'+
      '</span></div>'+
      (promo && promo.type==='rebate'?'<small class="market-promo-price-note">After customer rebate</small>':'')+
      (!isPackage && /battery/i.test(f.power)?'<small class="market-sold-separate">Battery and charger sold separately</small>':'')+
      (include?'<small class="market-package-includes">'+esc(include)+'</small>':'')+
      (savings?'<small class="market-package-savings">'+esc(savings)+'</small>':'')+
      '<div class="market-price-inventory">'+inventoryMarkup(f,v,isPackage?'package':'unit')+'</div>'+
    '</div>';
  }

  function familyPriceMarkup(f){
    const tool=f.variants.find(v=>!/kit|package/i.test(v.type));
    const kit=f.variants.find(v=>/kit|package/i.test(v.type));
    const rows=[];
    if(tool) rows.push(pricePanel('Unit',tool,false,f));
    if(kit) rows.push(pricePanel('Package',kit,true,f));
    if(!rows.length && f.variants[0]) rows.push(pricePanel('Price',f.variants[0],false,f));
    return '<div class="market-price-lines">'+rows.join('')+'</div>';
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

    function card(f){
    const first=f.variants[0]||{};
    const specs=familySpecs(f).slice(0,4);
    const description=[f.power,f.subcategory].filter(Boolean).join(' - ');
    const equipmentMode=state.shopMode==='equipment';
    const optionsUrl='product-options.html?sku='+encodeURIComponent(first.sku||'')+'&category='+encodeURIComponent(f.category)+(['BILLYGOAT','TORO','HONDA','REDMAX','GREENWORKS','MITM'].includes(f.brand)?'&brand='+encodeURIComponent(f.brand):'');
    const runtimeUrl='index.html?category='+encodeURIComponent(f.category)+'&sku='+encodeURIComponent(first.sku||'')+'&view=runtime';
    return '<article class="market-card" data-key="'+esc(f.key)+'">'+
      '<header class="market-card-head"><h3><strong>'+esc(f.model)+'</strong>'+(description?'<span>'+esc(description)+'</span>':'')+'</h3></header>'+
      '<div class="market-card-body">'+
        '<section class="market-card-left">'+
          '<div class="market-image-wrap">'+
            offerOverlay(f)+
            (
              (first.productUrl||f.productUrl)
                ? (
                  '<a class="market-image" href="'+esc(first.productUrl||f.productUrl)+'" target="_blank" rel="noopener">'+
                  (f.image?'<img src="'+esc(f.image)+'" alt="'+esc(f.brand+' '+f.model)+'" loading="lazy">':'<span>Image Coming Soon</span>')+
                  '</a>'
                )
                : (
                  '<div class="market-image">'+
                  (f.image?'<img src="'+esc(f.image)+'" alt="'+esc(f.brand+' '+f.model)+'" loading="lazy">':'<span>Image Coming Soon</span>')+
                  '</div>'
                )
            )+
          '</div>'+
          '<div class="market-detail-actions">'+
            ((first.productUrl||f.productUrl)?'<a class="market-product-details" href="'+esc(first.productUrl||f.productUrl)+'" target="_blank" rel="noopener">View Details</a>':'')+
            '<label class="market-product-details market-compare-detail"><input type="checkbox" data-compare="'+esc(f.key)+'" '+(state.compare.has(f.key)?'checked':'')+'> <span>Compare</span></label>'+
          '</div>'+
        '</section>'+
        '<section class="market-buy">'+
          familyPriceMarkup(f)+
          (equipmentMode
            ? '<div class="market-actions"><a href="'+optionsUrl+'">'+(/battery/i.test(f.power)?'View Accessories':'View Options')+'</a>'+
                (/battery/i.test(f.power)?'<a href="'+runtimeUrl+'" target="_blank">Run/Charge Times</a>':'')+
              '</div>'
            : '')+
          cartMarkup(f)+
        '</section>'+
      '</div>'+
      (specs.length?'<dl class="market-specs">'+specs.map(([l,v])=>'<div><dt>'+esc(l)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>':'')+
    '</article>';
  }

  let cardRenderVersion=0;
  function renderCards(){
    if(!marketplaceHasSelection()){
      $('#market-grid').innerHTML='';
      return;
    }
    const version=++cardRenderVersion;
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
    offset=batchSize;
    function appendBatch(){
      // A changed filter invalidates any pending cards from the previous results.
      if(version!==cardRenderVersion) return;
      grid.insertAdjacentHTML('beforeend',families.slice(offset,offset+batchSize).map(card).join(''));
      offset+=batchSize;
      if(offset<families.length) setTimeout(appendBatch,16);
      else grid.setAttribute('aria-busy','false');
    }
    if(offset<families.length) setTimeout(appendBatch,16);
  }

  function renderResultMeta(){
    const showProducts=marketplaceHasSelection();
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
  function compareTable(){
    const selected=activeFamilies().filter(f=>state.compare.has(f.key));
    const fams=(selected.length?selected:DATA.filtered).slice(0,24);
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
        else if(r==='Starting Price') v=f.price?money(f.price):'Contact Us';
        else if(r==='Availability') v=availabilityText(f);
        else v=f.specs[r]||'';
        return '<td>'+esc(v)+'</td>';
      }).join('')+'</tr>').join('')+'</tbody></table></div>';
  }

  function updateCompareButton(){
    const b=$('#market-compare-float');
    const n=state.compare.size;
    b.textContent=n ? 'Compare '+n+' Selected' : 'Compare '+DATA.filtered.length+' Products';
    b.disabled=n ? n<2 : DATA.filtered.length<2;
  }

  function updateCartFloat(){
    let cart=[];
    try{ cart=JSON.parse(localStorage.getItem('wepCart')||'[]'); if(!Array.isArray(cart)) cart=[]; }catch(e){ cart=[]; }
    const n=cart.reduce((sum,x)=>sum+(Number(x.quantity)||0),0);
    const count=$('#market-cart-count');
    if(count) count.textContent=n ? String(n) : '';
  }

  function resetContext(){
    state.seriesOrEngine=''; state.width=''; state.specFilters.clear();
  }

  function track(name,params={}){
    try{
      if(typeof window.gtag==='function') window.gtag('event',name,Object.assign({device_type:matchMedia('(max-width: 800px)').matches?'mobile':'desktop'},params));
      window.dataLayer=window.dataLayer||[];
      window.dataLayer.push(Object.assign({event:name},params));
    }catch(e){}
  }

  function returnMarketplaceHome(){
    state.shopMode='equipment';
    state.category='';state.subcategory='';state.power='';
    state.seriesOrEngine='';state.width='';
    state.brand.clear();state.availability.clear();
    state.buyOnline=false;state.promoOnly=false;state.search='';
    state.specFilters.clear();state.hpRanges.clear();
    state.seriesModelOpen=false;state.seriesModelView='';
    state.seriesFilter='';state.modelFilter='';
    state.packageFilter='';state.packageComponents.clear();state.openBFilter='';
    $('#market-search').value='';
    $('#filter-buy-online').checked=false;
    renderTopFilters();renderSidebar();filterFamilies();
    const home=$('[data-market-home]');
    if(home) home.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
    track('marketplace_home');
  }

  function wire(){
    document.addEventListener('click',e=>{
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
      if(s){ const v=s.dataset.subcategory||''; state.subcategory=state.subcategory===v?'':v; state.power='';state.seriesFilter='';state.modelFilter='';state.seriesModelView='';state.seriesModelOpen=false;state.hpRanges.clear();state.packageFilter='';state.packageComponents.clear();state.openBFilter='';state.seriesOrEngine='';state.width='';state.specFilters.clear(); renderTopFilters(); renderSidebar(); filterFamilies(); track('marketplace_subcategory',{subcategory:state.subcategory||'all'}); return; }
      const p=e.target.closest('[data-power]');
      if(p){
        const v=p.dataset.power||'';
        state.power=state.power===v?'':v;
        state.seriesOrEngine='';
        state.seriesFilter='';
        state.modelFilter='';
        state.seriesModelView='';
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

        state.modelFilter='';

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

    $('#market-search').addEventListener('input',e=>{ state.search=e.target.value; filterFamilies(); });
    $('#market-clear').addEventListener('click',()=>{
      state.shopMode='equipment';state.category='';state.subcategory='';state.power='';state.seriesOrEngine='';state.width='';state.brand.clear();state.availability.clear();state.buyOnline=false;state.promoOnly=false;state.search='';state.specFilters.clear();state.packageFilter='';
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
    if(logo){ const img=$('#market-dealer-logo'); img.src=logo; img.alt=name; img.hidden=false; }
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

    return ['STIHL','YANMAR','BILLYGOAT','TORO','HONDA','REDMAX','GREENWORKS','MITM']
      .map(id=>brands[id])
      .filter(Boolean);
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
      const response=await fetch(url,{cache:'default',credentials:'same-origin'});
      if(!response.ok)throw new Error('Combined catalog HTTP '+response.status);
      const bundle=await response.json();
      const expected=marketplaceBrandProfiles().map(p=>clean(p.id).toUpperCase());
      if(bundle.schema!==1 || JSON.stringify(bundle.brands)!==JSON.stringify(expected) ||
         bundle.componentBrand!==clean(activeBrand().id).toUpperCase() ||
         !Array.isArray(bundle.productSources) || bundle.productSources.length!==expected.length ||
         bundle.productSources.some((table,i)=>table.brand!==expected[i]) || !bundle.tables){
        throw new Error('Combined catalog does not match this Marketplace');
      }
      const products=bundle.productSources.flatMap(unpackMarketplaceTable);
      if(!products.length)throw new Error('Combined catalog has no products');
      const result=[products,...['batteries','chargers','compatibility','financePrograms','settingsRows'].map(name=>unpackMarketplaceTable(bundle.tables[name]))];
      window.WESTEND_MARKETPLACE_CATALOG_SOURCE='combined';
      return result;
    }catch(error){
      console.warn('Combined catalog unavailable; loading original CSV files.',error);
      window.WESTEND_MARKETPLACE_CATALOG_SOURCE='csv-fallback';
      return Promise.all([
        loadMarketplaceProducts(),
        csv(brandDataPath('batteries.csv')),
        csv(brandDataPath('chargers.csv')),
        csv(brandDataPath('compatibility-runtime.csv')),
        csv(brandDataPath('finance-programs.csv')),
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
          if(!response.ok) return [brand,new Set()];
          const data=await response.json();
          const set=new Set(
            (Array.isArray(data.availability)?data.availability:[])
              .filter(x=>num(x.quantity)>0)
              .map(x=>skuKey(x.sku))
              .filter(Boolean)
          );
          return [brand,set];
        }catch(error){
          console.warn('Inventory availability unavailable for '+brand,error);
          return [brand,new Set()];
        }
      })
    );

    DATA.inventoryByBrand=new Map(results);
  }

  async function init(){
    try{
      const [catalog,locations]=await Promise.all([
        loadMarketplaceCatalog(),
        loadMarketplaceLocations()
      ]);
      const [products,batteries,chargers,compatibility,financePrograms,settingsRows]=catalog;
      DATA.products=products;
      DATA.batteries=batteries;
      DATA.chargers=chargers;
      DATA.compatibility=compatibility;
      DATA.financePrograms=financePrograms;
      DATA.batterySystems=new Set(
        batteries.filter(x=>truthy(x.Active)).map(x=>clean(x.BatteryID).match(/^[A-Za-z]+/)?.[0]||'').filter(Boolean).map(x=>x.toUpperCase())
      );
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
      renderTopFilters(); renderSidebar(); filterFamilies(); wire(); updateCartFloat();
      $('#market-loading').hidden=true; $('#market-app').hidden=false;
      window.WESTEND_MARKETPLACE_READY_MS=Math.round(performance.now());
    }catch(err){
      console.error(err);
      $('#market-loading').innerHTML='<strong>Unable to load product data.</strong><br>'+esc(err.message||err);
    }
  }

  document.addEventListener('DOMContentLoaded',init);
})();
