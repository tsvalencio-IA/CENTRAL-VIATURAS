import { ImageResponse } from '@vercel/og';
import React from 'react';

const h=React.createElement;

function clampSize(value){
  const n=Number(value||512);
  if(!Number.isFinite(n)) return 512;
  return Math.max(64,Math.min(1024,Math.round(n)));
}

export async function GET(request){
  const url=new URL(request.url);
  const size=clampSize(url.searchParams.get('size'));
  const maskable=url.searchParams.get('maskable')==='1';
  const pad=maskable ? Math.round(size*.12) : Math.round(size*.055);
  const border=Math.max(3,Math.round(size*.012));

  const icon=h('div',{
    style:{
      width:size+'px',height:size+'px',display:'flex',position:'relative',
      alignItems:'center',justifyContent:'center',
      background:'linear-gradient(145deg,#050b12 0%,#0b1c2a 55%,#09251f 100%)',
      overflow:'hidden',fontFamily:'Arial, sans-serif'
    }
  },
    h('div',{style:{position:'absolute',right:-Math.round(size*.18)+'px',top:-Math.round(size*.16)+'px',width:Math.round(size*.62)+'px',height:Math.round(size*.62)+'px',borderRadius:'999px',background:'#2ca7ff',opacity:.86,display:'flex'}}),
    h('div',{style:{position:'absolute',left:-Math.round(size*.22)+'px',bottom:-Math.round(size*.28)+'px',width:Math.round(size*.74)+'px',height:Math.round(size*.74)+'px',borderRadius:'999px',background:'#35d08a',opacity:.82,display:'flex'}}),
    h('div',{style:{
      position:'absolute',inset:pad+'px',borderRadius:Math.round(size*.19)+'px',
      background:'rgba(7,18,28,.96)',border:border+'px solid #28465d',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      boxShadow:'0 24px 55px rgba(0,0,0,.42)',overflow:'hidden'
    }},
      h('div',{style:{position:'absolute',top:Math.round(size*.07)+'px',fontSize:Math.round(size*.055)+'px',fontWeight:900,letterSpacing:Math.round(size*.004)+'px',color:'#9fdcff',display:'flex'}},'VALÊNCIO'),
      h('div',{style:{
        width:Math.round(size*.60)+'px',height:Math.round(size*.25)+'px',
        marginTop:Math.round(size*.04)+'px',borderRadius:Math.round(size*.08)+'px '+Math.round(size*.08)+'px '+Math.round(size*.04)+'px '+Math.round(size*.04)+'px',
        background:'#f5f9fc',border:border+'px solid #2ca7ff',position:'relative',
        display:'flex',alignItems:'center',justifyContent:'center'
      }},
        h('div',{style:{position:'absolute',top:-Math.round(size*.055)+'px',width:Math.round(size*.31)+'px',height:Math.round(size*.10)+'px',borderRadius:Math.round(size*.05)+'px '+Math.round(size*.05)+'px 0 0',background:'#89c9ee',border:border+'px solid #2ca7ff',display:'flex'}}),
        h('div',{style:{position:'absolute',left:Math.round(size*.055)+'px',bottom:Math.round(size*.03)+'px',width:Math.round(size*.075)+'px',height:Math.round(size*.075)+'px',borderRadius:'999px',background:'#112a3d',display:'flex'}}),
        h('div',{style:{position:'absolute',right:Math.round(size*.055)+'px',bottom:Math.round(size*.03)+'px',width:Math.round(size*.075)+'px',height:Math.round(size*.075)+'px',borderRadius:'999px',background:'#112a3d',display:'flex'}}),
        h('div',{style:{width:Math.round(size*.23)+'px',height:Math.round(size*.055)+'px',borderRadius:'999px',background:'#35d08a',display:'flex'}})
      ),
      h('div',{style:{marginTop:Math.round(size*.075)+'px',fontSize:Math.round(size*.16)+'px',fontWeight:1000,letterSpacing:Math.round(size*.008)+'px',lineHeight:1,color:'#ffffff',display:'flex'}},'SOS'),
      h('div',{style:{marginTop:Math.round(size*.025)+'px',fontSize:Math.round(size*.036)+'px',fontWeight:800,letterSpacing:Math.round(size*.003)+'px',color:'#9bb0c2',display:'flex'}},'ACOMPANHAMENTO')
    )
  );

  return new ImageResponse(icon,{
    width:size,height:size,
    headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}
  });
}
