import React from 'react';
import './KboPromoBanner.css';

/** Pass the existing kboGameUrl(googleId); keep account hints out of static assets. */
export default function KboPromoBanner({href='https://kbo-sim.vercel.app/',variant='a',compact=false,onDismiss}){
  const alternate=variant==='b';
  return <aside className={'kbo-promo'+(alternate?' kbo-promo--b':'')+(compact?' kbo-promo--side':'')} aria-label="KBO 구단주 게임 안내">
    <div className="kbo-promo__copy">
      <div className="kbo-promo__brand">KBO 구단주 <span className="kbo-promo__badge">BETA</span></div>
      <h2 className="kbo-promo__title">{compact?<>응원팀의<br/>가을야구를<br/>만들어보세요.</>:alternate?'응원팀의 가을야구, 직접 만들어보세요.':'이번엔, 구단주가 되어보세요.'}</h2>
      <p className="kbo-promo__desc">{compact?'드래프트부터 시즌 운영까지':alternate?'선수를 뽑고, 전술을 정하고. 당신의 선택으로 만드는 시즌.':'25명 드래프트부터 144경기 운영까지. 오늘의 단장'}</p>
    </div>
    {!compact&&<div className="kbo-promo__art" aria-hidden="true"><svg viewBox="0 0 164 108" fill="none"><path d="M19 89L79 11L150 83" stroke="#a3b587" strokeOpacity=".18"/><path d="M2 104L79 5L164 104" stroke="#a3b587" strokeOpacity=".08"/><path d="M47 63Q83 20 122 63L84 102Z" fill="#657756" fillOpacity=".13" stroke="#93a67b" strokeOpacity=".35"/><path d="M62 78L84 56L107 78L84 100Z" stroke="#d7c994" strokeOpacity=".55"/><path d="M84 78L84 56M84 78L62 78M84 78L107 78" stroke="#d7c994" strokeOpacity=".12"/><path d="M80 98H88L87 103H81Z" fill="#f7d77c"/><rect x="59" y="75" width="6" height="6" transform="rotate(-45 59 75)" fill="#b9c99e"/><rect x="81" y="53" width="6" height="6" transform="rotate(-45 81 53)" fill="#b9c99e"/><rect x="104" y="75" width="6" height="6" transform="rotate(-45 104 75)" fill="#b9c99e"/><path d="M13 20H52V46H13Z" fill="#142421" stroke="#68795b"/><text x="32.5" y="38" textAnchor="middle" fill="#f7d77c" fontFamily="Arial" fontSize="17" fontWeight="700">25</text><text x="32.5" y="15" textAnchor="middle" fill="#9cae98" fontFamily="Arial" fontSize="6" letterSpacing="1.3">PLAYERS</text><path d="M103 14H154V43H103Z" fill="#142421" stroke="#68795b"/><text x="128.5" y="34" textAnchor="middle" fill="#f7d77c" fontFamily="Arial" fontSize="19" fontWeight="700">144</text><text x="128.5" y="9" textAnchor="middle" fill="#9cae98" fontFamily="Arial" fontSize="6" letterSpacing="1.3">GAMES</text><circle cx="145" cy="81" r="3" fill="#f7d77c" fillOpacity=".85"/><path d="M144 82Q117 30 80 48" stroke="#f7d77c" strokeOpacity=".3" strokeDasharray="2 3"/></svg></div>}
    <div className="kbo-promo__action"><a className="kbo-promo__cta" href={href} target="_blank" rel="noopener noreferrer" aria-label="KBO 구단주에서 새 구단 만들기 (새 탭)">구단 만들기 <span aria-hidden="true">↗</span></a><small className="kbo-promo__hint">새 탭에서 시작해요</small></div>
    {onDismiss&&!compact&&<button type="button" className="kbo-promo__close" onClick={onDismiss} aria-label="이 배너 닫기">×</button>}
  </aside>;
}
