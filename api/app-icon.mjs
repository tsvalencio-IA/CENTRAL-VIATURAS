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
  const plateFont=Math.round(size*.23);
  const border=Math.max(3,Math.round(size*.012));

  const icon=h('div',{
    style:{
      width:size+'px',height:size+'px',display:'flex',position:'relative',
      alignItems:'center',justifyContent:'center',
      background:'linear-gradient(145deg,#06111b 0%,#0c2233 100%)',
      overflow:'hidden',fontFamily:'sans-serif'
    }
  },
    h('div',{style:{position:'absolute',right:-Math.round(size*.16)+'px',top:-Math.round(size*.12)+'px',width:Math.round(size*.58)+'px',height:Math.round(size*.58)+'px',borderRadius:'999px',background:'#20a7ff',opacity:.95,display:'flex'}}),
    h('div',{style:{position:'absolute',left:-Math.round(size*.18)+'px',bottom:-Math.round(size*.24)+'px',width:Math.round(size*.70)+'px',height:Math.round(size*.70)+'px',borderRadius:'999px',background:'#39d98a',opacity:.95,display:'flex'}}),
    h('div',{style:{
      position:'absolute',inset:pad+'px',borderRadius:Math.round(size*.18)+'px',
      background:'#0d1b28',border:border+'px solid #29465c',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      boxShadow:'0 20px 45px rgba(0,0,0,.35)'
    }},
      h('div',{style:{position:'absolute',top:Math.round(size*.135)+'px',width:Math.round(size*.56)+'px',height:Math.round(size*.105)+'px',borderRadius:Math.round(size*.035)+'px',background:'#132838',display:'flex'}}),
      h('div',{style:{
        width:Math.round(size*.66)+'px',height:Math.round(size*.29)+'px',
        marginTop:Math.round(size*.035)+'px',borderRadius:Math.round(size*.055)+'px',
        background:'#f7fbff',border:border+'px solid #20a7ff',
        display:'flex',alignItems:'center',justifyContent:'center',
        color:'#07131e',fontSize:plateFont+'px',fontWeight:900,letterSpacing:Math.round(size*.012)+'px'
      }},'CV'),
      h('div',{style:{marginTop:Math.round(size*.10)+'px',width:Math.round(size*.44)+'px',height:Math.round(size*.085)+'px',borderRadius:Math.round(size*.04)+'px',background:'#20a7ff',display:'flex'}}),
      h('div',{style:{position:'absolute',bottom:Math.round(size*.055)+'px',width:Math.round(size*.12)+'px',height:Math.max(4,Math.round(size*.025))+'px',borderRadius:'999px',background:'#39d98a',display:'flex'}})
    )
  );

  return new ImageResponse(icon,{
    width:size,height:size,
    headers:{'Cache-Control':'public, s-maxage=86400, stale-while-revalidate=604800'}
  });
}