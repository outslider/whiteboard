/* ITインフラ用アイコン（オリジナルSVG、64x64）
 * 追加したい場合は ICONS に {id, name, cat, svg, kw} を足すだけでパレットに表示されます。
 */
(function () {
  const S = '#343a40';
  const blue = '#1c7ed6', lblue = '#74c0fc', dblue = '#1864ab', gray = '#868e96', dgray = '#495057';
  const green = '#40c057', red = '#e03131';

  const tower = (x = 18, c = dgray) => `
    <rect x="${x}" y="4" width="28" height="56" rx="3" fill="${c}"/>
    <rect x="${x + 4}" y="10" width="20" height="5" rx="1" fill="${gray}"/>
    <rect x="${x + 4}" y="18" width="20" height="5" rx="1" fill="${gray}"/>
    <rect x="${x + 4}" y="26" width="20" height="5" rx="1" fill="${gray}"/>
    <path d="M${x + 5} 38h18M${x + 5} 42h18" stroke="${gray}" stroke-width="1.5"/>
    <circle cx="${x + 21}" cy="51" r="2.2" fill="#51cf66"/>`;
  const badge = (inner, bg) => `<circle cx="47" cy="47" r="13" fill="${bg}" stroke="#fff" stroke-width="2"/>${inner}`;
  const tagServer = (txt, bg) => tower(10) + `<rect x="30" y="34" width="32" height="18" rx="4" fill="${bg}" stroke="#fff" stroke-width="1.5"/>
    <text x="46" y="47.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${txt.length > 3 ? 9 : 11}" fill="#fff">${txt}</text>`;
  const envelope = (x, y, w, h, c = blue, fill = '#fff') => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${c}" stroke-width="3"/>
    <path d="M${x + 2} ${y + 3}L${x + w / 2} ${y + h * 0.55}L${x + w - 2} ${y + 3}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`;
  const person = (cx, cy, r, c1, c2) => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>
    <path d="M${cx - r * 2} ${cy + r * 3.6}C${cx - r * 2} ${cy + r * 1.9} ${cx - r} ${cy + r * 1.35} ${cx} ${cy + r * 1.35}C${cx + r} ${cy + r * 1.35} ${cx + r * 2} ${cy + r * 1.9} ${cx + r * 2} ${cy + r * 3.6}Z" fill="${c2}"/>`;
  const gear = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${r * 0.5}" stroke-dasharray="${r * 0.42} ${r * 0.37}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="#fff"/>`;
  const doc = (c = '#fff', s = gray) => `<path d="M14 4h26l12 12v44H14Z" fill="${c}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 4v12h12" fill="none" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>`;
  const lock = (x, y, s, body, shackle) => `<path d="M${x + s * 0.22} ${y + s * 0.45}V${y + s * 0.3}a${s * 0.28} ${s * 0.28} 0 0 1 ${s * 0.56} 0V${y + s * 0.45}" fill="none" stroke="${shackle}" stroke-width="${s * 0.1}"/>
    <rect x="${x}" y="${y + s * 0.42}" width="${s}" height="${s * 0.58}" rx="${s * 0.08}" fill="${body}"/>
    <circle cx="${x + s / 2}" cy="${y + s * 0.66}" r="${s * 0.07}" fill="#fff"/><rect x="${x + s * 0.47}" y="${y + s * 0.68}" width="${s * 0.06}" height="${s * 0.16}" fill="#fff"/>`;
  const virus = (cx, cy, r, c1, c2) => {
    let s = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
      const x2 = cx + Math.cos(a) * r * 1.55, y2 = cy + Math.sin(a) * r * 1.55;
      s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c2}" stroke-width="${r * 0.22}" stroke-linecap="round"/>
            <circle cx="${(cx + Math.cos(a) * r * 1.7).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 1.7).toFixed(1)}" r="${r * 0.22}" fill="${c2}"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>
      <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.3}" r="${r * 0.2}" fill="${c2}"/><circle cx="${cx + r * 0.4}" cy="${cy + r * 0.1}" r="${r * 0.16}" fill="${c2}"/><circle cx="${cx - r * 0.1}" cy="${cy + r * 0.45}" r="${r * 0.13}" fill="${c2}"/>`;
  };
  const cloudPath = 'M16 48C5 48 5 33 16 32C15 21 28 15 35 23C40 15 55 19 52 31C63 32 62 48 51 48Z';
  const arrow = (x1, y1, x2, y2, c = '#fff', w = 2.6) => {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 5;
    const p1 = [x2 - L * Math.cos(a - 0.6), y2 - L * Math.sin(a - 0.6)], p2 = [x2 - L * Math.cos(a + 0.6), y2 - L * Math.sin(a + 0.6)];
    return `<path d="M${x1} ${y1}L${x2} ${y2}M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${x2} ${y2}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const switchBox = (top, front, side) => `
    <path d="M4 26L16 16H60L48 26Z" fill="${top}"/>
    <rect x="4" y="26" width="44" height="22" fill="${front}"/>
    <path d="M48 26L60 16V38L48 48Z" fill="${side}"/>
    ${arrow(14, 20, 34, 20)}${arrow(48, 23.5, 28, 23.5)}`;

  const ICONS = [
    // 人
    { id: 'user', name: 'ユーザー', cat: '人', kw: 'user person 人 社員', svg: person(32, 18, 10, '#4dabf7', blue) },
    { id: 'users', name: 'グループ', cat: '人', kw: 'users group チーム 部署', svg: person(43, 17, 7.5, '#a5d8ff', '#74c0fc') + person(24, 24, 9, '#4dabf7', blue) },
    { id: 'admin', name: '管理者', cat: '人', kw: 'admin 管理者 情シス', svg: person(28, 18, 10, '#4dabf7', blue) + gear(48, 48, 9, '#f08c00') },
    { id: 'guest', name: '外部ユーザー', cat: '人', kw: 'guest 外部 取引先 顧客', svg: person(32, 18, 10, '#ced4da', '#868e96') },
    { id: 'attacker', name: '攻撃者', cat: '人', kw: 'attacker hacker 攻撃者 ハッカー', svg: `
      <path d="M12 60C12 30 19 6 32 6C45 6 52 30 52 60Z" fill="#343a40"/>
      <ellipse cx="32" cy="28" rx="10" ry="12" fill="#1a1d20"/>
      <circle cx="28" cy="27" r="2" fill="#fa5252"/><circle cx="36" cy="27" r="2" fill="#fa5252"/>` },
    { id: 'bot', name: 'AI / Bot', cat: '人', kw: 'ai bot ロボット エージェント 生成AI', svg: `
      <path d="M32 6v8" stroke="${dgray}" stroke-width="3"/><circle cx="32" cy="6" r="3.5" fill="#f08c00"/>
      <rect x="10" y="14" width="44" height="36" rx="10" fill="#7048e8"/>
      <rect x="16" y="22" width="32" height="18" rx="6" fill="#e5dbff"/>
      <circle cx="25" cy="31" r="3.5" fill="#5f3dc4"/><circle cx="39" cy="31" r="3.5" fill="#5f3dc4"/>
      <rect x="4" y="26" width="6" height="12" rx="2" fill="#5f3dc4"/><rect x="54" y="26" width="6" height="12" rx="2" fill="#5f3dc4"/>
      <rect x="22" y="52" width="20" height="6" rx="2" fill="#5f3dc4"/>` },

    // 端末
    { id: 'pc', name: 'PC', cat: '端末', kw: 'pc desktop パソコン デスクトップ 端末', svg: `
      <rect x="6" y="8" width="52" height="36" rx="3" fill="${dgray}"/><rect x="10" y="12" width="44" height="28" fill="${lblue}"/>
      <path d="M27 44L25 53H39L37 44Z" fill="${gray}"/><rect x="17" y="53" width="30" height="5" rx="2" fill="${dgray}"/>` },
    { id: 'laptop', name: 'ノートPC', cat: '端末', kw: 'laptop ノート pc 端末', svg: `
      <rect x="12" y="12" width="40" height="29" rx="3" fill="${dgray}"/><rect x="15.5" y="15.5" width="33" height="22" fill="${lblue}"/>
      <path d="M4 43H60L56 51H8Z" fill="${gray}"/><rect x="27" y="44" width="10" height="2" rx="1" fill="${dgray}"/>` },
    { id: 'smartphone', name: 'スマートフォン', cat: '端末', kw: 'smartphone スマホ 携帯 iphone android mobile', svg: `
      <rect x="19" y="5" width="26" height="54" rx="5" fill="${S}"/><rect x="22" y="11" width="20" height="40" fill="${lblue}"/>
      <circle cx="32" cy="55" r="1.8" fill="#adb5bd"/>` },
    { id: 'tablet', name: 'タブレット', cat: '端末', kw: 'tablet タブレット ipad', svg: `
      <rect x="9" y="7" width="46" height="50" rx="5" fill="${S}"/><rect x="13" y="11" width="38" height="39" fill="${lblue}"/>
      <circle cx="32" cy="53.5" r="1.8" fill="#adb5bd"/>` },
    { id: 'printer', name: 'プリンター/複合機', cat: '端末', kw: 'printer プリンター 複合機 mfp', svg: `
      <rect x="18" y="5" width="28" height="18" fill="#fff" stroke="${gray}" stroke-width="2"/>
      <rect x="6" y="20" width="52" height="24" rx="4" fill="${gray}"/><circle cx="50" cy="28" r="2.4" fill="#51cf66"/>
      <rect x="16" y="37" width="32" height="20" fill="#fff" stroke="${gray}" stroke-width="2"/>
      <path d="M21 44h22M21 49h16" stroke="#adb5bd" stroke-width="2"/>` },
    { id: 'ipphone', name: 'IP電話', cat: '端末', kw: 'phone 電話 ip電話 内線', svg: `
      <rect x="8" y="24" width="48" height="32" rx="6" fill="${dgray}"/>
      <path d="M5 20C5 9 59 9 59 20V25H46V19H18V25H5Z" fill="${S}"/>
      ${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${20 + c * 9}" y="${30 + r * 8}" width="6" height="5" rx="1" fill="#dee2e6"/>`).join('')).join('')}` },
    { id: 'camera', name: '監視カメラ', cat: '端末', kw: 'camera カメラ 監視 防犯 iot', svg: `
      <path d="M6 14H50L54 30H10Z" fill="#dee2e6" stroke="${gray}" stroke-width="2"/>
      <circle cx="46" cy="22" r="4" fill="${S}"/><path d="M24 30V42H12M12 36V50" fill="none" stroke="${gray}" stroke-width="4"/>` },
    { id: 'iot', name: 'IoTデバイス', cat: '端末', kw: 'iot センサー sensor 機器', svg: `
      <rect x="14" y="20" width="36" height="36" rx="6" fill="#0c8599"/><circle cx="32" cy="38" r="8" fill="#99e9f2"/>
      <path d="M22 12a14 14 0 0 1 20 0M26 16a8 8 0 0 1 12 0" fill="none" stroke="#0c8599" stroke-width="3" stroke-linecap="round"/>` },

    // サーバ
    { id: 'server', name: 'サーバ', cat: 'サーバ', kw: 'server サーバ サーバー 物理', svg: tower() },
    { id: 'rack', name: 'サーバラック', cat: 'サーバ', kw: 'rack ラック データセンター dc', svg: `
      <rect x="10" y="3" width="44" height="58" rx="2" fill="${S}"/>
      ${[0, 1, 2, 3].map(k => `<rect x="14" y="${7 + k * 13}" width="36" height="10" rx="1" fill="${gray}"/><circle cx="45" cy="${12 + k * 13}" r="1.7" fill="#51cf66"/><path d="M18 ${12 + k * 13}h16" stroke="${dgray}" stroke-width="2"/>`).join('')}` },
    { id: 'vm', name: '仮想サーバ', cat: 'サーバ', kw: 'vm 仮想 virtual ec2 compute インスタンス', svg: `
      <rect x="6" y="6" width="52" height="52" rx="6" fill="none" stroke="${gray}" stroke-width="2.5" stroke-dasharray="5 4"/>
      <rect x="14" y="14" width="36" height="36" rx="4" fill="#4c6ef5"/>
      <path d="M20 24h24M20 32h24M20 40h24" stroke="#bac8ff" stroke-width="3"/>` },
    { id: 'container', name: 'コンテナ', cat: 'サーバ', kw: 'container コンテナ docker kubernetes k8s', svg: `
      ${[[6, 30], [24, 30], [42, 30], [15, 12], [33, 12]].map(([x, y]) => `<rect x="${x}" y="${y}" width="16" height="16" rx="2" fill="#1098ad"/><path d="M${x + 4} ${y + 3}v10M${x + 8} ${y + 3}v10M${x + 12} ${y + 3}v10" stroke="#99e9f2" stroke-width="1.6"/>`).join('')}
      <path d="M4 50H60" stroke="#0b7285" stroke-width="4" stroke-linecap="round"/>` },
    { id: 'database', name: 'データベース', cat: 'サーバ', kw: 'database db データベース sql mysql', svg: `
      <path d="M12 14V50A20 7 0 0 0 52 50V14Z" fill="#f59f00"/>
      <ellipse cx="32" cy="14" rx="20" ry="7" fill="#ffd43b"/>
      <path d="M12 26A20 7 0 0 0 52 26M12 38A20 7 0 0 0 52 38" fill="none" stroke="#e67700" stroke-width="2.5"/>` },
    { id: 'storage', name: 'ストレージ/NAS', cat: 'サーバ', kw: 'storage nas ストレージ ファイルサーバ san', svg: `
      <rect x="6" y="14" width="52" height="36" rx="4" fill="${dgray}"/>
      ${[0, 1, 2, 3].map(k => `<rect x="${11 + k * 11}" y="19" width="8" height="22" rx="1" fill="${gray}"/><circle cx="${15 + k * 11}" cy="45" r="1.6" fill="#51cf66"/>`).join('')}` },
    { id: 'webserver', name: 'Webサーバ', cat: 'サーバ', kw: 'web http サーバ apache nginx', svg: tower(10) + badge(`<circle cx="47" cy="47" r="10" fill="#339af0"/><ellipse cx="47" cy="47" rx="4.5" ry="10" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M37 47h20M38.5 42h17M38.5 52h17" stroke="#fff" stroke-width="1.6"/>`, '#339af0') },
    { id: 'mailserver', name: 'メールサーバ', cat: 'サーバ', kw: 'mail メールサーバ smtp exchange', svg: tower(10) + `<rect x="30" y="36" width="32" height="22" rx="3" fill="#fff" stroke="${blue}" stroke-width="2.5"/><path d="M31.5 38L46 49L60.5 38" fill="none" stroke="${blue}" stroke-width="2.5"/>` },
    { id: 'ad', name: 'AD/認証', cat: 'サーバ', kw: 'ad active directory 認証 ldap idp entra', svg: tagServer('AD', '#7048e8') },
    { id: 'dns', name: 'DNSサーバ', cat: 'サーバ', kw: 'dns 名前解決', svg: tagServer('DNS', '#0c8599') },
    { id: 'dhcp', name: 'DHCPサーバ', cat: 'サーバ', kw: 'dhcp', svg: tagServer('DHCP', '#2f9e44') },
    { id: 'proxy', name: 'プロキシ', cat: 'サーバ', kw: 'proxy プロキシ', svg: tagServer('PRX', '#e8590c') },
    { id: 'backup', name: 'バックアップ', cat: 'サーバ', kw: 'backup バックアップ 復旧', svg: `
      <path d="M10 14V44A16 6 0 0 0 42 44V14Z" fill="${gray}"/><ellipse cx="26" cy="14" rx="16" ry="6" fill="#ced4da"/>
      <path d="M10 24A16 6 0 0 0 42 24M10 34A16 6 0 0 0 42 34" fill="none" stroke="${dgray}" stroke-width="2"/>
      ${badge(`<path d="M41 43a7 7 0 1 1 1 8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M38 40l3 4 4-3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`, '#2f9e44')}` },

    // ネットワーク
    { id: 'internet', name: 'インターネット', cat: 'ネットワーク', kw: 'internet インターネット globe wan web', svg: `
      <circle cx="32" cy="32" r="25" fill="#339af0"/>
      <ellipse cx="32" cy="32" rx="11" ry="25" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="M7 32H57M10 20H54M10 44H54M32 7V57" stroke="#fff" stroke-width="2"/>` },
    { id: 'cloud', name: 'クラウド', cat: 'ネットワーク', kw: 'cloud クラウド aws azure gcp', svg: `<path d="${cloudPath}" fill="#d0ebff" stroke="${blue}" stroke-width="3" stroke-linejoin="round"/>` },
    { id: 'router', name: 'ルーター', cat: 'ネットワーク', kw: 'router ルータ ルーター l3', svg: `
      <path d="M6 26V40A26 11 0 0 0 58 40V26Z" fill="${dblue}"/>
      <ellipse cx="32" cy="26" rx="26" ry="11" fill="${blue}"/>
      ${arrow(26, 23, 15, 19)}${arrow(38, 29, 49, 33)}${arrow(48, 18, 37, 22.5)}${arrow(16, 34, 27, 29.5)}` },
    { id: 'switch', name: 'L2スイッチ', cat: 'ネットワーク', kw: 'switch スイッチ l2 hub', svg: switchBox('#4dabf7', blue, dblue) +
      [0, 1, 2, 3, 4, 5].map(k => `<rect x="${8 + k * 6.5}" y="36" width="4.5" height="5" fill="#d0ebff"/>`).join('') },
    { id: 'l3switch', name: 'L3スイッチ', cat: 'ネットワーク', kw: 'l3 switch スイッチ コア core', svg: switchBox('#9775fa', '#7048e8', '#5f3dc4') +
      `<text x="26" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="12" fill="#fff">L3</text>` },
    { id: 'firewall', name: 'ファイアウォール', cat: 'ネットワーク', kw: 'firewall fw ファイアウォール utm', svg: `
      <rect x="6" y="10" width="52" height="44" rx="2" fill="${red}"/>
      <path d="M6 21H58M6 32H58M6 43H58" stroke="#fff" stroke-width="2"/>
      <path d="M22 10V21M42 10V21M14 21V32M32 21V32M50 21V32M22 32V43M42 32V43M14 43V54M32 43V54M50 43V54" stroke="#fff" stroke-width="2"/>` },
    { id: 'utm', name: 'UTM', cat: 'ネットワーク', kw: 'utm セキュリティアプライアンス', svg: `
      <rect x="4" y="22" width="56" height="22" rx="3" fill="${red}"/>
      <path d="M4 33H60M18 22V33M32 22V33M46 22V33M11 33V44M25 33V44M39 33V44M53 33V44" stroke="#fff" stroke-width="1.6"/>
      <text x="32" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="11" fill="${red}">UTM</text>` },
    { id: 'wifi', name: '無線AP', cat: 'ネットワーク', kw: 'wifi 無線 ap アクセスポイント wlan', svg: `
      <path d="M10 18a31 31 0 0 1 44 0M16 25a22 22 0 0 1 32 0M22 32a13 13 0 0 1 20 0" fill="none" stroke="${blue}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="38" r="3" fill="${blue}"/><rect x="14" y="44" width="36" height="12" rx="6" fill="${dgray}"/>
      <circle cx="40" cy="50" r="1.8" fill="#51cf66"/>` },
    { id: 'lb', name: 'ロードバランサ', cat: 'ネットワーク', kw: 'lb load balancer ロードバランサ 負荷分散', svg: `
      <rect x="4" y="18" width="56" height="28" rx="5" fill="#7048e8"/>
      <path d="M10 32H26" stroke="#fff" stroke-width="2.6"/>${arrow(26, 32, 50, 24)}${arrow(26, 32, 52, 32)}${arrow(26, 32, 50, 40)}` },
    { id: 'onu', name: 'ONU/モデム', cat: 'ネットワーク', kw: 'onu モデム modem 回線 光 ntt', svg: `
      <rect x="10" y="22" width="44" height="26" rx="4" fill="#dee2e6" stroke="${gray}" stroke-width="2"/>
      ${[0, 1, 2, 3].map(k => `<circle cx="${20 + k * 8}" cy="35" r="2.4" fill="${k < 3 ? '#51cf66' : '#ffd43b'}"/>`).join('')}
      <path d="M46 22V8" stroke="${gray}" stroke-width="3" stroke-linecap="round"/>` },
    { id: 'vpn', name: 'VPN', cat: 'ネットワーク', kw: 'vpn トンネル ipsec 暗号化 閉域', svg: `
      <rect x="2" y="24" width="60" height="22" rx="11" fill="#96f2d7"/>
      <path d="M2 35H18M46 35H62" stroke="#0ca678" stroke-width="2" stroke-dasharray="3 3"/>
      ${lock(21, 12, 22, '#087f5b', '#087f5b')}` },
    { id: 'building', name: '拠点/オフィス', cat: 'ネットワーク', kw: 'building 拠点 オフィス 本社 支店 site', svg: `
      <rect x="12" y="6" width="40" height="54" fill="#adb5bd"/><rect x="12" y="6" width="40" height="5" fill="${dgray}"/>
      ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${17 + c * 11}" y="${15 + r * 9}" width="8" height="6" fill="#e7f5ff"/>`).join('')).join('')}
      <rect x="27" y="50" width="10" height="10" fill="${dgray}"/>` },
    { id: 'datacenter', name: 'データセンター', cat: 'ネットワーク', kw: 'datacenter dc データセンター', svg: `
      <path d="M4 22L32 8L60 22V58H4Z" fill="#dee2e6" stroke="${gray}" stroke-width="2"/>
      ${[0, 1, 2].map(k => `<rect x="${12 + k * 14}" y="26" width="10" height="28" fill="${S}"/><circle cx="${17 + k * 14}" cy="31" r="1.4" fill="#51cf66"/><path d="M${14 + k * 14} 37h6M${14 + k * 14} 42h6M${14 + k * 14} 47h6" stroke="${gray}" stroke-width="1.5"/>`).join('')}` },

    // セキュリティ
    { id: 'virus', name: 'ウイルス', cat: 'セキュリティ', kw: 'virus ウイルス ウィルス マルウェア malware 感染', svg: virus(32, 32, 14, green, '#2b8a3e') },
    { id: 'malware', name: 'マルウェア', cat: 'セキュリティ', kw: 'malware マルウェア バグ 不正プログラム ウィルス', svg: `
      <path d="M18 24L8 18M46 24L56 18M16 36H5M48 36H59M18 47L8 54M46 47L56 54M27 12L22 4M37 12L42 4" stroke="#862e9c" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="32" cy="16" r="8" fill="#862e9c"/><ellipse cx="32" cy="38" rx="15" ry="19" fill="#ae3ec9"/>
      <path d="M32 21V57" stroke="#862e9c" stroke-width="2.5"/><circle cx="29" cy="15" r="1.8" fill="#fff"/><circle cx="35" cy="15" r="1.8" fill="#fff"/>` },
    { id: 'ransomware', name: 'ランサムウェア', cat: 'セキュリティ', kw: 'ransomware ランサム 暗号化 身代金', svg: doc('#fff5f5', red) +
      `<path d="M20 26h20M20 33h16M20 40h20" stroke="#ffa8a8" stroke-width="2.5"/>${badge('', red)}${lock(40, 37, 14, '#fff', '#fff')}` },
    { id: 'lock', name: '鍵（ロック）', cat: 'セキュリティ', kw: 'lock 鍵 ロック 暗号 セキュア', svg: lock(14, 4, 36, '#f59f00', dgray) },
    { id: 'key', name: 'キー', cat: 'セキュリティ', kw: 'key 鍵 キー 認証 パスワード', svg: `
      <circle cx="20" cy="32" r="13" fill="none" stroke="#f59f00" stroke-width="7"/>
      <path d="M33 32H58M50 32V42M42 32V40" stroke="#f59f00" stroke-width="7" stroke-linejoin="round"/>` },
    { id: 'shield', name: 'セキュリティ対策', cat: 'セキュリティ', kw: 'shield 盾 保護 セキュリティ edr av', svg: `
      <path d="M32 5L54 13V30C54 44 44 54 32 59C20 54 10 44 10 30V13Z" fill="#2f9e44"/>
      <path d="M21 31L29 39L44 23" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { id: 'warning', name: '警告', cat: 'セキュリティ', kw: 'warning 警告 注意 危険 アラート', svg: `
      <path d="M32 6L60 56H4Z" fill="#fcc419" stroke="#f08c00" stroke-width="3" stroke-linejoin="round"/>
      <path d="M32 23V40" stroke="${S}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="48" r="3" fill="${S}"/>` },
    { id: 'blocked', name: '遮断/禁止', cat: 'セキュリティ', kw: 'block 遮断 禁止 拒否 deny', svg: `
      <circle cx="32" cy="32" r="24" fill="#fff" stroke="${red}" stroke-width="7"/><path d="M15 15L49 49" stroke="${red}" stroke-width="7"/>` },
    { id: 'cert', name: '証明書', cat: 'セキュリティ', kw: 'certificate 証明書 ssl tls 電子証明書', svg: `
      <rect x="4" y="8" width="56" height="40" rx="3" fill="#fff9db" stroke="#f08c00" stroke-width="2.5"/>
      <path d="M12 18h28M12 25h24M12 32h18" stroke="#fab005" stroke-width="2.5"/>
      <path d="M44 42L40 58L46 54L50 60L52 42" fill="${red}"/><circle cx="47" cy="36" r="8" fill="#f59f00"/>` },
    { id: 'mfa', name: '多要素認証', cat: 'セキュリティ', kw: 'mfa 2fa 多要素 認証 ワンタイム', svg: `
      <rect x="16" y="4" width="32" height="56" rx="5" fill="${S}"/><rect x="19" y="10" width="26" height="40" fill="#e7f5ff"/>
      <text x="32" y="35" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="10" fill="${blue}">●●●</text>
      ${badge(`<path d="M41 47L45.5 51.5L53 43" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`, '#2f9e44')}` },

    // メール・データ
    { id: 'mail', name: 'メール', cat: 'メール・データ', kw: 'mail メール email 電子メール', svg: envelope(6, 14, 52, 36) },
    { id: 'mail-send', name: 'メール送信', cat: 'メール・データ', kw: 'mail send 送信 メール', svg: envelope(4, 18, 40, 30) + arrow(40, 12, 60, 12, '#2f9e44', 4) },
    { id: 'phishing', name: 'フィッシング', cat: 'メール・データ', kw: 'phishing フィッシング 詐欺 なりすまし 標的型', svg: envelope(4, 22, 42, 30) + `
      <path d="M52 4V24A6 6 0 0 1 40 24V20" fill="none" stroke="${red}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M40 20L36 25" stroke="${red}" stroke-width="3.5" stroke-linecap="round"/>` },
    { id: 'spam', name: '迷惑メール', cat: 'メール・データ', kw: 'spam 迷惑メール スパム 不審 添付', svg: envelope(4, 14, 44, 32, '#e8590c', '#fff4e6') + badge(`<path d="M47 40V49" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="47" cy="54" r="2" fill="#fff"/>`, red) },
    { id: 'file', name: 'ファイル', cat: 'メール・データ', kw: 'file ファイル 文書 document', svg: doc() + `<path d="M20 28h24M20 36h24M20 44h16" stroke="#adb5bd" stroke-width="2.5"/>` },
    { id: 'folder', name: 'フォルダ', cat: 'メール・データ', kw: 'folder フォルダ 共有 share', svg: `
      <path d="M4 14C4 11 6 10 8 10H24L29 16H56C58 16 60 17 60 20V52C60 54 58 56 56 56H8C6 56 4 54 4 52Z" fill="#fab005"/>
      <path d="M4 24H60V52C60 54 58 56 56 56H8C6 56 4 54 4 52Z" fill="#ffd43b"/>` },
    { id: 'data', name: 'データ', cat: 'メール・データ', kw: 'data データ 情報 個人情報', svg: `
      <rect x="8" y="8" width="48" height="48" rx="4" fill="#e7f5ff" stroke="${blue}" stroke-width="2.5"/>
      <path d="M8 22H56M8 36H56M24 8V56M40 8V56" stroke="${blue}" stroke-width="2"/>` },
    { id: 'chat', name: 'チャット', cat: 'メール・データ', kw: 'chat チャット teams slack メッセージ', svg: `
      <path d="M8 10H48C51 10 52 12 52 14V38C52 40 51 42 48 42H24L12 52V42H8C5 42 4 40 4 38V14C4 12 5 10 8 10Z" fill="#5c7cfa"/>
      <circle cx="17" cy="26" r="3" fill="#fff"/><circle cx="28" cy="26" r="3" fill="#fff"/><circle cx="39" cy="26" r="3" fill="#fff"/>` },
    { id: 'saas', name: 'SaaS', cat: 'メール・データ', kw: 'saas クラウドサービス m365 google workspace アプリ', svg: `
      <path d="${cloudPath}" fill="#e5dbff" stroke="#7048e8" stroke-width="3" stroke-linejoin="round"/>
      ${[[23, 28], [33, 28], [23, 38], [33, 38]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="7" rx="1.5" fill="#7048e8"/>`).join('')}` },
    { id: 'api', name: 'API', cat: 'メール・データ', kw: 'api 連携 webhook integration', svg: `
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#0c8599"/>
      <text x="32" y="38" text-anchor="middle" font-family="Consolas,monospace" font-weight="bold" font-size="15" fill="#fff">&lt;/&gt;</text>` },
    { id: 'gear', name: '設定', cat: 'メール・データ', kw: 'gear 設定 歯車 運用 管理 config', svg: gear(32, 32, 20, dgray) },
    { id: 'power', name: 'UPS/電源', cat: 'メール・データ', kw: 'ups 電源 停電 power 電力', svg: `
      <rect x="14" y="8" width="36" height="50" rx="4" fill="${dgray}"/><rect x="26" y="4" width="12" height="5" rx="1" fill="${dgray}"/>
      <path d="M35 16L23 35H32L29 50L42 29H33Z" fill="#fcc419"/>` },
  ];

  const CATEGORIES = ['人', '端末', 'サーバ', 'ネットワーク', 'セキュリティ', 'メール・データ'];
  const byId = Object.fromEntries(ICONS.map(i => [i.id, i]));
  const symbols = ICONS.map(i => `<symbol id="ic-${i.id}" viewBox="0 0 64 64">${i.svg}</symbol>`).join('');
  const standalone = id => {
    const i = byId[id];
    return i ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${i.svg}</svg>` : null;
  };
  window.WB_ICONS = { ICONS, CATEGORIES, byId, symbols, standalone };
})();
