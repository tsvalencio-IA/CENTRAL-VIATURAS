import { ImageResponse } from '@vercel/og';
import React from 'react';

function cleanPlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

const h = React.createElement;

export default async function handler(req) {
  const url = new URL(req.url);
  const plate = cleanPlate(url.searchParams.get('placa'));
  if (!plate) return new Response('Placa inválida.', { status: 400 });

  const page = h('div', {
    style: {
      width: '1200px',
      height: '630px',
      display: 'flex',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg,#06111b 0%,#10283b 100%)',
      color: '#eef6ff',
      fontFamily: 'sans-serif',
      overflow: 'hidden'
    }
  },
    h('div', {
      style: {
        position: 'absolute',
        width: '430px',
        height: '430px',
        borderRadius: '215px',
        right: '-120px',
        top: '-170px',
        background: 'rgba(32,167,255,.08)',
        display: 'flex'
      }
    }),
    h('div', {
      style: {
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '250px',
        left: '-170px',
        bottom: '-290px',
        background: 'rgba(57,217,138,.06)',
        display: 'flex'
      }
    }),

    h('div', {
      style: {
        position: 'absolute',
        top: '42px',
        left: '54px',
        right: '54px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    },
      h('div', {
        style: {
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '1px',
          color: '#b9cad8',
          display: 'flex'
        }
      }, 'CENTRAL DE VIATURAS'),
      h('div', {
        style: {
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          color: '#6f879b',
          display: 'flex'
        }
      }, 'ACOMPANHAMENTO')
    ),

    h('div', {
      style: {
        width: '590px',
        height: '470px',
        borderRadius: '44px',
        background: '#0d1b28',
        border: '3px solid #28445a',
        boxShadow: '0 24px 55px rgba(0,0,0,.38)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '34px 42px 32px 42px'
      }
    },
      h('div', {
        style: {
          width: '100%',
          height: '58px',
          borderRadius: '18px',
          background: '#132838',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '23px',
          fontWeight: 800,
          color: '#dce8f3',
          letterSpacing: '1.2px'
        }
      }, 'VIATURA'),

      h('div', {
        style: {
          marginTop: '28px',
          width: '100%',
          height: '184px',
          borderRadius: '28px',
          background: '#f7fbff',
          border: '7px solid #20a7ff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      },
        h('div', {
          style: {
            width: '100%',
            height: '38px',
            background: '#e9f5ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2d6fa3',
            fontSize: '15px',
            fontWeight: 900,
            letterSpacing: '2px'
          }
        }, 'BRASIL • CENTRAL'),
        h('div', {
          style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#07131e',
            fontSize: plate.length > 7 ? '74px' : '86px',
            fontWeight: 900,
            letterSpacing: '5px'
          }
        }, plate)
      ),

      h('div', {
        style: {
          marginTop: '28px',
          width: '432px',
          height: '72px',
          borderRadius: '22px',
          background: '#20a7ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#04111b',
          fontSize: '27px',
          fontWeight: 900,
          letterSpacing: '.8px'
        }
      }, 'ABRIR VIATURA')
    ),

    h('div', {
      style: {
        position: 'absolute',
        left: '54px',
        bottom: '27px',
        fontSize: '17px',
        color: '#72879a',
        display: 'flex'
      }
    }, 'Powered by thIAguinho Soluções Digitais')
  );

  return new ImageResponse(page, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
