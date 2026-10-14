import { defaultTokens, type DesignNode, type DesignProject, type NodeStyle } from './types.js';
import { defaultDesignSystem } from './design-system.js';

const C = { bg: '#0b0c0e', panel: '#191b20', panel2: '#22252a', line: '#303339', white: '#f3f4f5', gray: '#9fa3ad', muted: '#717782', orange: '#ff650b', green: '#9cc8aa' };
const sans = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function createDemoProject(id: string, name = 'GaugeReel Mobile'): DesignProject {
  let sequence = 0;
  const nodes: DesignNode[] = [];
  const add = (type: DesignNode['type'], name: string, parentId: string | null, x: number, y: number, width: number, height: number, styles: NodeStyle = {}, content?: string, source?: string): string => {
    const nodeId = `gauge-${++sequence}`;
    nodes.push({ id: nodeId, type, name, parentId, x, y, width, height, styles, ...(content === undefined ? {} : { content }), ...(source === undefined ? {} : { source }) });
    return nodeId;
  };
  const frame = (p: string | null, name: string, x: number, y: number, w: number, h: number, fill = C.panel, radius = 16, extra: NodeStyle = {}) => add('frame', name, p, x, y, w, h, { fill, radius, ...extra });
  const rect = (p: string, name: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, extra: NodeStyle = {}) => add('rectangle', name, p, x, y, w, h, { fill, radius, ...extra });
  const text = (p: string | null, name: string, x: number, y: number, w: number, h: number, content: string, size = 16, color = C.white, weight = 400, align: NodeStyle['textAlign'] = 'left') => add('text', name, p, x, y, w, h, { fontFamily: sans, fontSize: size, color, fontWeight: weight, textAlign: align }, content);
  const line = (p: string, x: number, y: number, w: number, color = C.line) => add('line', 'Divider', p, x, y, w, 1, { fill: color });
  const ellipse = (p: string, name: string, x: number, y: number, w: number, h: number, fill: string) => add('ellipse', name, p, x, y, w, h, { fill });
  const svg = (p: string, name: string, x: number, y: number, w: number, h: number, markup: string, radius = 0) => add('code', name, p, x, y, w, h, { radius }, undefined, markup);
  const icon = (p: string, kind: string, x: number, y: number, size = 22, color: string = C.white) => {
    const paths: Record<string, string> = {
      back: '<path d="m15 5-7 7 7 7"/>', chevron: '<path d="m9 5 7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
      check: '<path d="m5 12 4 4L19 6"/>', play: '<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
      film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>', link: '<path d="m10 13 4-4m-7 5-1 1a4 4 0 0 0 6 6l4-4a4 4 0 0 0 0-6M17 10l1-1a4 4 0 0 0-6-6L8 7a4 4 0 0 0 0 6"/>',
      ride: '<circle cx="5.5" cy="16.5" r="4"/><circle cx="18.5" cy="16.5" r="4"/><path d="m5.5 16.5 5-9 5 9h-10m5-9h5m-6-3h3m3 3 3 9.5"/>',
      run: '<circle cx="15.5" cy="4" r="2"/><path d="m7 9 5-3 4 6 4 1m-8-7-3 7 5 4 1 5m-6-9-5 5H1"/>', hike: '<circle cx="14" cy="3.5" r="2"/><path d="m10 8 4-2 2 6 4 1m-6-7-3 8-1 7m1-7 5 7M5 8l-2 14m3-13 4-2"/>',
      spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>', gear: '<circle cx="12" cy="12" r="4"/><path d="m9 3 1-2h4l1 2 3 2 2-.2 2 3.4-1.2 1.8v4l1.2 1.8-2 3.4-2-.2-3 2-1 2h-4l-1-2-3-2-2 .2L2 15.6l1.2-1.8v-4L2 8l2-3.4L6 5Z"/>',
      strava: '<path d="m10 2 6 11H4Z" fill="currentColor" stroke="none"/><path d="m17 11 4 7-4 7-4-7Z" fill="currentColor" opacity=".6" stroke="none"/>', phone: '<rect x="6" y="1" width="12" height="22" rx="3"/><path d="M10 4h4m-4 16h4"/>',
      monitor: '<rect x="1" y="4" width="22" height="15" rx="2"/><path d="M8 23h8m-4-4v4"/>', volume: '<path d="M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
      download: '<path d="M12 2v14m-5-5 5 5 5-5M4 17v5h16v-5"/>', user: '<circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3"/>', help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3v.1"/>',
      apple: '<path d="M15.5 6c-1-.5-2-.5-3.5.2C7 3.4 3.5 8.3 5.5 13.7c1.5 4.3 3 7 5 6 1.1-.6 1.9-.6 3 0 2.2 1 4-2.7 5-5.2-3.6-1.7-3.7-5.6-.5-7.3-.8-1-1.6-1.1-2.5-1.2ZM12 5c-.2-2.3 1.2-4.5 4-5-.1 2.6-1.4 4.8-4 5Z" fill="currentColor" stroke="none"/>',
      trim: '<path d="M7 2v20M17 2v20M2 7h20M2 17h20"/>', sliders: '<path d="M4 3v18M12 3v18M20 3v18"/><circle cx="4" cy="8" r="2" fill="#0b0c0e"/><circle cx="12" cy="16" r="2" fill="#0b0c0e"/><circle cx="20" cy="9" r="2" fill="#0b0c0e"/>',
    };
    return svg(p, `${kind[0].toUpperCase()}${kind.slice(1)} icon`, x, y, size, size, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" color="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[kind] ?? paths.spark}</svg>`);
  };
  const button = (p: string, label: string, y: number, variant: 'orange' | 'dark' | 'outline' = 'orange', x = 26, width = 338, height = 52) => {
    const b = frame(p, label, x, y, width, height, variant === 'orange' ? C.orange : variant === 'dark' ? C.panel : 'transparent', 28, variant === 'outline' ? { borderColor: C.line, borderWidth: 1 } : {});
    text(b, 'Button label', 12, (height - 21) / 2, width - 24, 23, label, 15, C.white, 650, 'center');
    return b;
  };
  const pill = (p: string, label: string, x: number, y: number, width: number, fill: string = C.panel2, color: string = C.gray) => {
    const b = frame(p, label, x, y, width, 26, fill, 13);
    text(b, 'Badge label', 5, 6, width - 10, 15, label, 10, color, 650, 'center');
    return b;
  };
  const screen = (name: string, col: number, y: number) => {
    return frame(null, name, 80 + col * 464, y + 80, 390, 844, C.bg, 0);
  };
  const top = (p: string, title: string, step?: string) => {
    icon(p, 'back', 22, 75, 22, C.gray);
    if (step) text(p, 'Step', 230, 79, 134, 16, step, 11, C.gray, 500, 'right');
    text(p, 'Screen heading', 26, 132, 338, 94, title, 32, C.white, 700);
  };
  const brand = (p: string, x = 26, y = 72, size = 24) => {
    svg(p, 'GaugeReel mark', x, y, size, size, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v5H9v10H4Zm9 8h7v8h-7v-4h3v-1h-3Z" fill="${C.orange}"/></svg>`);
    text(p, 'GaugeReel wordmark', x + size + 8, y - 1, 200, size + 7, 'GaugeReel', size, C.white, 750);
  };
  const landscape = (p: string, x: number, y: number, w: number, h: number, variant = 0) => svg(p, 'Editable mountain footage', x, y, w, h, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><rect width="600" height="340" fill="${variant === 2 ? '#343d42' : '#3c4542'}"/><path d="M0 148 105 55l78 97 83-120 90 104 73-88 171 116v176H0Z" fill="${variant === 1 ? '#242d2d' : '#2d3b34'}"/><path d="m0 196 96-83 92 96 90-70 115 86 94-100 113 74v141H0Z" fill="#1f3027"/><path d="m0 261 116-58 136 86 135-70 120 39 93-39v121H0Z" fill="#14251d"/><path d="M-30 334c94-63 179-27 249-74s140-68 214-32 128-3 194-41" fill="none" stroke="#5d5a4c" stroke-width="22"/><path d="M-30 334c94-63 179-27 249-74s140-68 214-32 128-3 194-41" fill="none" stroke="#8d8972" stroke-width="2"/><path d="M-30 334c94-63 179-27 249-74s140-68 214-32 128-3 194-41" fill="none" stroke="#ff650b" stroke-width="3" stroke-dasharray="5 11"/><path d="m460 285 9-26 9 26Zm30 10 13-39 13 39Zm-362-80 9-28 9 28Z" fill="#102018"/></svg>`, 12);
  const metric = (p: string, x: number, y: number, value: string, label: string, width = 90, size = 24) => {
    text(p, label, x, y, width, 31, value, size, C.white, 700);
    text(p, `${label} label`, x, y + 34, width, 17, label, 10, C.gray, 450);
  };
  const progress = (p: string, step: number) => {
    for (let i = 0; i < 4; i++) rect(p, 'Onboarding progress', 26 + i * 86, 111, 76, 3, i < step ? C.orange : C.panel2, 2);
  };
  const section = (title: string, subtitle: string, y: number) => {
    text(null, title, 80, y, 3200, 100, `${title} · ${subtitle}`, 72, '#ededed', 650);
  };

  section('Sign in → onboarding → home', 'shown on a Free account', 44);

  const signIn = screen('01 Sign in', 0, 200);
  brand(signIn, 26, 60, 21);
  text(signIn, 'Welcome heading', 26, 143, 338, 42, 'Welcome to GaugeReel', 29, C.white, 700);
  text(signIn, 'Welcome description', 26, 199, 338, 37, 'Sign in to pick up where you left off.', 13, C.gray);
  const tabs = frame(signIn, 'Authentication tabs', 26, 265, 338, 43, C.panel, 24);
  frame(tabs, 'Selected sign-in tab', 4, 4, 162, 35, '#30333a', 20);
  text(tabs, 'Sign in tab label', 11, 13, 148, 18, 'Sign in', 12, C.white, 650, 'center');
  text(tabs, 'Create account tab label', 174, 13, 153, 18, 'Create account', 12, C.gray, 500, 'center');
  text(signIn, 'Email label', 26, 337, 338, 17, 'Email', 11, C.gray, 500);
  const email = frame(signIn, 'Email input', 26, 363, 338, 47, C.panel, 10);
  text(email, 'Email placeholder', 15, 16, 308, 19, 'you@example.com', 12, C.muted);
  text(signIn, 'Password label', 26, 431, 338, 17, 'Password', 11, C.gray, 500);
  const password = frame(signIn, 'Password input', 26, 457, 338, 47, C.panel, 10);
  text(password, 'Password placeholder', 15, 16, 308, 19, 'Enter your password', 12, C.muted);
  button(signIn, 'Sign in', 527, 'orange', 26, 338, 45);
  text(signIn, 'Forgot password', 26, 590, 338, 18, 'Forgot password?', 11, C.gray, 500, 'center');
  line(signIn, 26, 635, 142);
  text(signIn, 'Alternative sign in separator', 173, 629, 44, 16, 'OR', 9, C.muted, 500, 'center');
  line(signIn, 223, 635, 141);
  const apple = frame(signIn, 'Continue with Apple', 26, 659, 338, 43, '#efeff0', 23);
  icon(apple, 'apple', 69, 12, 18, '#17181b');
  text(apple, 'Button label', 38, 14, 288, 18, 'Continue with Apple', 12, '#17181b', 650, 'center');
  const google = button(signIn, 'Continue with Google', 716, 'outline', 26, 338, 43);
  text(google, 'Google mark', 66, 12, 20, 20, 'G', 16, C.white, 700);
  text(signIn, 'Terms', 32, 804, 326, 28, 'By continuing, you agree to our Terms and Privacy Policy.', 8, C.muted, 400, 'center');

  const sports = screen('02 What do you film', 1, 200);
  progress(sports, 1);
  top(sports, 'What do you film?', '1 OF 4');
  text(sports, 'Supporting text', 26, 202, 330, 42, 'We’ll get your reels ready for your kind\nof adventure.', 14, C.gray);
  [['Cycling', 'ride'], ['Running', 'run'], ['Hiking', 'hike'], ['A bit of everything', 'spark']].forEach(([label, kind], i) => {
    const selected = i === 0;
    const card = frame(sports, label, 26 + (i % 2) * 177, 283 + Math.floor(i / 2) * 173, 161, 157, selected ? '#271b14' : C.panel, 15, selected ? { borderColor: C.orange, borderWidth: 1.5 } : {});
    icon(card, kind, 22, 25, 38, selected ? C.orange : '#adb0b7');
    text(card, 'Sport label', 18, 113, 132, 25, label, label.length > 12 ? 12 : 15, C.white, 600);
    if (selected) { ellipse(card, 'Selected', 127, 15, 20, 20, C.orange); icon(card, 'check', 131, 19, 12); }
  });
  button(sports, 'Continue', 727);
  text(sports, 'Selection hint', 26, 688, 338, 18, 'You can change this anytime.', 11, C.muted, 400, 'center');

  const format = screen('03 Where do you post', 2, 200);
  progress(format, 2);
  top(format, 'Where do you post?', '2 OF 4');
  text(format, 'Supporting text', 26, 202, 330, 40, 'Choose your usual format. Every reel can\nhave its own.', 14, C.gray);
  const vertical = frame(format, 'Vertical format', 26, 277, 161, 291, '#271b14', 16, { borderColor: C.orange, borderWidth: 1.5 });
  const phone = frame(vertical, 'Phone preview', 39, 27, 83, 148, '#030405', 11, { borderColor: '#6c5d50', borderWidth: 3 });
  landscape(phone, 2, 2, 73, 138);
  rect(phone, 'Preview data band', 8, 93, 58, 30, '#111813c9', 5);
  text(phone, 'Preview speed', 15, 98, 50, 16, '32.6', 14, C.white, 750);
  text(vertical, 'Format title', 15, 207, 131, 23, 'Vertical', 17, C.white, 650, 'center');
  text(vertical, 'Format detail', 10, 237, 141, 17, '9:16 · Reels & Shorts', 10, C.gray, 400, 'center');
  const horizontal = frame(format, 'Horizontal format', 203, 277, 161, 291, C.panel, 16);
  landscape(horizontal, 12, 64, 137, 81, 1);
  text(horizontal, 'Format title', 15, 207, 131, 23, 'Horizontal', 17, C.white, 650, 'center');
  text(horizontal, 'Format detail', 10, 237, 141, 17, '16:9 · YouTube', 10, C.gray, 400, 'center');
  pill(format, 'Selected', 67, 590, 79, '#2b2119', '#ff955a');
  button(format, 'Continue', 727);

  const strava = screen('04 Connect Strava', 3, 200);
  progress(strava, 3);
  top(strava, 'Bring your ride\nalong for the edit.', '3 OF 4');
  text(strava, 'Supporting text', 26, 233, 330, 43, 'Connect Strava to sync your speed, route\nand elevation with every moment.', 14, C.gray);
  const connect = frame(strava, 'Connected ride preview', 26, 316, 338, 227, C.panel, 16);
  icon(connect, 'strava', 20, 19, 28, C.orange);
  text(connect, 'Strava wordmark', 60, 24, 190, 26, 'STRAVA', 19, C.orange, 800);
  pill(connect, 'AUTO SYNC', 241, 24, 78);
  svg(connect, 'Editable ride route', 18, 74, 302, 81, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 302 81"><path d="m3 52 33-28 17 7 24-23 32 16 18 37 33-16 20 21 26-34 26 15 32-33 33 13" fill="none" stroke="#343a3b" stroke-width="22" stroke-linecap="round"/><path d="m3 52 33-28 17 7 24-23 32 16 18 37 33-16 20 21 26-34 26 15 32-33 33 13" fill="none" stroke="${C.orange}" stroke-width="3" stroke-linecap="round"/><circle cx="3" cy="52" r="5" fill="#fff"/><circle cx="297" cy="27" r="5" fill="${C.orange}"/></svg>`);
  metric(connect, 20, 168, '42.8 km', 'DISTANCE', 100, 19);
  metric(connect, 136, 168, '1:48:32', 'MOVING TIME', 110, 19);
  metric(connect, 253, 168, '842 m', 'ELEVATION', 70, 19);
  button(strava, 'Connect with Strava', 623);
  button(strava, 'I’ll do this later', 690, 'outline');
  text(strava, 'Permission note', 42, 766, 306, 28, 'Read-only access. Your activities stay yours.', 10, C.muted, 400, 'center');

  const reels = screen('05 Your reels', 4, 200);
  brand(reels, 26, 73, 23);
  pill(reels, 'FREE', 309, 75, 55);
  text(reels, 'Screen heading', 26, 133, 235, 42, 'Your reels', 31, C.white, 700);
  const newReel = frame(reels, 'New reel', 255, 132, 109, 39, C.orange, 22);
  icon(newReel, 'plus', 12, 12, 15);
  text(newReel, 'Button label', 32, 12, 70, 18, 'New reel', 12, C.white, 650, 'center');
  const reel = frame(reels, 'Sunday in the hills reel', 26, 202, 338, 253, C.panel, 15);
  landscape(reel, 0, 0, 338, 175);
  pill(reel, '0:32', 280, 137, 44, '#090c0bbd', '#fff');
  text(reel, 'Reel title', 16, 192, 240, 24, 'Sunday in the hills', 17, C.white, 650);
  text(reel, 'Reel date', 16, 223, 240, 16, 'Sep 21 · Cycling · 42.8 km', 11, C.gray);
  icon(reel, 'chevron', 302, 201, 16, C.gray);
  const reel2 = frame(reels, 'Golden hour loop reel', 26, 472, 338, 214, C.panel, 15);
  landscape(reel2, 0, 0, 338, 137, 1);
  pill(reel2, 'DRAFT', 263, 14, 59, '#090c0bbd', '#e4e6e7');
  text(reel2, 'Reel title', 16, 155, 280, 23, 'Golden hour loop', 17, C.white, 650);
  text(reel2, 'Reel date', 16, 184, 270, 16, 'Sep 18 · Cycling · 28.2 km', 11, C.gray);
  line(reels, 0, 749, 390);
  icon(reels, 'film', 85, 768, 20, C.orange);
  text(reels, 'Reels tab', 64, 795, 62, 15, 'Reels', 10, C.orange, 600, 'center');
  icon(reels, 'user', 282, 768, 20, C.muted);
  text(reels, 'Account tab', 261, 795, 62, 15, 'Account', 10, C.muted, 500, 'center');

  const accountContent = (p: string) => {
    text(p, 'Screen heading', 26, 81, 290, 43, 'Account', 31, C.white, 700);
    ellipse(p, 'Avatar', 26, 154, 58, 58, '#343b34');
    text(p, 'Avatar initials', 26, 174, 58, 23, 'JS', 18, '#dce8d8', 650, 'center');
    text(p, 'Profile name', 101, 159, 250, 25, 'Jamie Smith', 18, C.white, 650);
    text(p, 'Profile email', 101, 190, 250, 18, 'jamie@example.com', 12, C.gray);
    const group = frame(p, 'Account settings', 26, 248, 338, 254, C.panel, 15);
    [['Your plan', 'Free'], ['Connected apps', 'Strava'], ['Default format', 'Vertical'], ['Units', 'Metric']].forEach(([label, detail], i) => {
      text(group, label, 17, 23 + i * 63, 174, 23, label, 14, C.white, 500);
      text(group, `${label} value`, 177, 25 + i * 63, 119, 20, detail, 12, i === 1 ? '#b9c9bb' : C.gray, 400, 'right');
      icon(group, 'chevron', 308, 25 + i * 63, 14, C.muted);
      if (i < 3) line(group, 17, 62 + i * 63, 304);
    });
    const help = frame(p, 'Support settings', 26, 527, 338, 126, C.panel, 15);
    text(help, 'Help label', 17, 22, 280, 22, 'Help & feedback', 14, C.white, 500);
    icon(help, 'chevron', 308, 25, 14, C.muted);
    line(help, 17, 62, 304);
    text(help, 'About label', 17, 85, 280, 21, 'About GaugeReel', 14, C.white, 500);
    icon(help, 'chevron', 308, 87, 14, C.muted);
    button(p, 'Sign out', 687, 'outline');
    text(p, 'Version', 26, 767, 338, 16, 'GaugeReel 1.0 · Built for the ride', 10, C.muted, 400, 'center');
  };
  const account = screen('06 Account', 5, 200);
  accountContent(account);
  const signOut = screen('07 Sign out', 6, 200);
  accountContent(signOut);
  rect(signOut, 'Modal backdrop', 0, 0, 390, 844, '#000000ac');
  const modal = frame(signOut, 'Sign out confirmation', 30, 296, 330, 266, '#202227', 22);
  text(modal, 'Confirmation heading', 24, 30, 282, 33, 'Heading out?', 25, C.white, 700);
  text(modal, 'Confirmation message', 24, 79, 282, 50, 'Your reels will be right here\nwhen you get back.', 14, '#aeb1b8');
  button(modal, 'Sign out', 151, 'orange', 24, 282, 45);
  button(modal, 'Stay here', 205, 'outline', 24, 282, 43);

  section('New reel: activity → clip → sync → look', 'Free until Plans, Basic after', 1174);

  const activityStart = screen('08 Start with your activity', 0, 1330);
  top(activityStart, 'Start with\nyour activity.');
  text(activityStart, 'Supporting text', 26, 235, 338, 42, 'The route, the effort, the good bits.\nLet’s find the ride behind your footage.', 14, C.gray);
  const sourceStrava = frame(activityStart, 'Strava activity source', 26, 328, 338, 116, C.panel, 16);
  icon(sourceStrava, 'strava', 21, 24, 32, C.orange);
  text(sourceStrava, 'Source title', 72, 23, 220, 26, 'From Strava', 18, C.white, 650);
  text(sourceStrava, 'Source description', 72, 58, 220, 36, 'Choose from your\nrecent activities', 12, C.gray);
  icon(sourceStrava, 'chevron', 302, 47, 17, C.gray);
  const sourceFile = frame(activityStart, 'GPX activity source', 26, 461, 338, 116, C.panel, 16);
  icon(sourceFile, 'upload', 24, 30, 27, '#adb0b7');
  text(sourceFile, 'Source title', 72, 23, 220, 26, 'Upload an activity', 18, C.white, 650);
  text(sourceFile, 'Source description', 72, 59, 220, 32, 'GPX or FIT file', 12, C.gray);
  icon(sourceFile, 'chevron', 302, 47, 17, C.gray);
  text(activityStart, 'Local privacy note', 42, 722, 306, 38, 'Your original footage stays on your device.\nYou decide what to share.', 11, C.muted, 400, 'center');

  const plans = screen('09 Pick the plan that fits', 1, 1330);
  top(plans, 'Pick the plan\nthat fits.');
  text(plans, 'Supporting text', 26, 229, 338, 36, 'A little more power for every adventure.', 14, C.gray);
  const planData = [
    { title: 'Free', price: '$0', detail: 'Try your first reels', items: '720p export · GaugeReel watermark', y: 292 },
    { title: 'Basic', price: '$6', detail: 'For your weekly rides', items: '1080p export · No watermark · All looks', y: 425 },
    { title: 'Pro', price: '$12', detail: 'For the whole story', items: '4K export · Advanced stats · Priority sync', y: 558 },
  ];
  for (const plan of planData) {
    const selected = plan.title === 'Basic';
    const card = frame(plans, `${plan.title} plan`, 26, plan.y, 338, 117, selected ? '#261b15' : C.panel, 15, selected ? { borderColor: C.orange, borderWidth: 1.5 } : {});
    text(card, 'Plan name', 18, 15, 180, 28, plan.title, 19, C.white, 650);
    text(card, 'Plan price', 242, 15, 78, 29, plan.price, 25, C.white, 700, 'right');
    text(card, 'Billing period', 264, 47, 56, 15, plan.title === 'Free' ? 'forever' : '/ month', 10, C.gray, 400, 'right');
    text(card, 'Plan description', 18, 46, 220, 20, plan.detail, 12, C.gray);
    text(card, 'Plan features', 18, 83, 304, 19, plan.items, 10, selected ? '#dfbdab' : C.gray);
    if (selected) pill(card, 'POPULAR', 96, 16, 69, '#4b2918', '#ffad7c');
  }
  button(plans, 'Continue with Basic', 716);
  text(plans, 'Billing note', 26, 784, 338, 16, 'Cancel anytime. No surprises.', 10, C.muted, 400, 'center');

  const chooseActivity = screen('10 Choose an activity', 2, 1330);
  top(chooseActivity, 'Choose an activity', '1 OF 4');
  text(chooseActivity, 'Supporting text', 26, 203, 338, 40, 'Find the ride that goes with your clip.', 14, C.gray);
  const sourceBadge = frame(chooseActivity, 'Connected Strava', 26, 264, 338, 45, C.panel, 10);
  icon(sourceBadge, 'strava', 13, 11, 21, C.orange);
  text(sourceBadge, 'Connected status', 47, 15, 200, 17, 'STRAVA CONNECTED', 10, C.gray, 650);
  text(sourceBadge, 'Refresh', 261, 15, 62, 17, 'Refresh', 11, C.white, 550, 'right');
  const activities = [['Sunday in the hills', 'Sun, Sep 21 · 8:32 AM', '42.8 km', '1:48:32', '842 m'], ['Golden hour loop', 'Thu, Sep 18 · 5:46 PM', '28.2 km', '1:12:08', '396 m'], ['Before-work spin', 'Tue, Sep 16 · 6:15 AM', '19.6 km', '0:52:41', '224 m']];
  activities.forEach(([title, date, distance, duration, elevation], i) => {
    const card = frame(chooseActivity, title, 26, 329 + i * 112, 338, 98, i === 0 ? '#261b15' : C.panel, 14, i === 0 ? { borderColor: C.orange, borderWidth: 1.5 } : {});
    text(card, 'Activity name', 16, 16, 280, 23, title, 15, C.white, 650);
    text(card, 'Activity date', 16, 44, 280, 16, date, 10, C.gray);
    text(card, 'Activity metrics', 16, 71, 290, 16, `${distance}     ${duration}     ${elevation}`, 11, '#c4c7cd', 500);
    if (i === 0) { ellipse(card, 'Selected activity', 303, 17, 18, 18, C.orange); icon(card, 'check', 307, 21, 10); }
  });
  button(chooseActivity, 'Use this activity', 727);

  const clip = screen('11 Add your clip', 3, 1330);
  top(clip, 'Add your clip', '2 OF 4');
  text(clip, 'Supporting text', 26, 202, 338, 43, 'Bring in your camera footage.\nWe’ll find where it fits in the ride.', 14, C.gray);
  const drop = frame(clip, 'Video upload area', 26, 284, 338, 286, C.panel, 16, { borderColor: '#34373f', borderWidth: 1 });
  const iconPlate = frame(drop, 'Film icon background', 136, 40, 66, 66, '#272a30', 19);
  icon(iconPlate, 'film', 19, 18, 29, '#b9bec8');
  text(drop, 'Upload heading', 24, 132, 290, 29, 'Your footage goes here', 20, C.white, 650, 'center');
  text(drop, 'Upload requirements', 24, 175, 290, 40, 'MP4 or MOV · Up to 4 GB\nAction camera, phone, or anything else.', 11, C.gray, 400, 'center');
  button(drop, 'Choose a video', 228, 'outline', 77, 184, 42);
  const activityContext = frame(clip, 'Selected activity', 26, 596, 338, 71, C.panel, 13);
  icon(activityContext, 'ride', 16, 23, 24, C.orange);
  text(activityContext, 'Selected activity title', 55, 15, 265, 22, 'Sunday in the hills', 14, C.white, 600);
  text(activityContext, 'Selected activity detail', 55, 43, 265, 17, '42.8 km · Sep 21', 10, C.gray);
  button(clip, 'Continue', 727, 'dark');

  const sync = screen('12 Sync your clip', 4, 1330);
  top(sync, 'Your clip starts\n15:59.6 into the ride', '3 OF 4');
  text(sync, 'Supporting text', 26, 238, 338, 36, 'We found a match. Fine-tune if you need to.', 12, C.gray);
  const syncPreview = frame(sync, 'Sync video preview', 26, 296, 338, 226, C.panel, 15);
  landscape(syncPreview, 0, 0, 338, 226);
  const playback = frame(syncPreview, 'Play video', 145, 87, 48, 48, '#0b0c0e9e', 24);
  icon(playback, 'play', 14, 13, 22);
  pill(syncPreview, '00:00 / 00:32', 210, 184, 111, '#0b0c0ec4', C.white);
  text(sync, 'Activity timeline title', 26, 552, 260, 22, 'Activity timeline', 13, C.white, 600);
  text(sync, 'Sync confidence', 246, 555, 118, 18, 'MATCHED', 10, C.green, 700, 'right');
  const timeline = frame(sync, 'Activity altitude timeline', 26, 588, 338, 82, C.panel, 12);
  svg(timeline, 'Editable elevation graph', 10, 10, 318, 58, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 318 58"><path d="m0 48 13-7 17 5 14-21 15 7 13-15 16 8 17-19 16 18 18-5 15 20 20-4 12 12 17-17 18 5 20-26 18 4 18 21 26 9v14H0Z" fill="#4e555c"/><path d="M83 0v58" stroke="#ff650b" stroke-width="2"/><rect x="82" y="0" width="98" height="58" fill="#ff650b" fill-opacity=".17"/><path d="M181 0v58" stroke="#ff650b" stroke-width="2"/></svg>`);
  text(sync, 'Timeline start', 26, 682, 92, 17, '00:00', 10, C.muted);
  text(sync, 'Timeline end', 279, 682, 85, 17, '1:48:32', 10, C.muted, 400, 'right');
  button(sync, 'Looks right — continue', 727);

  const look = screen('13 Pick a look', 5, 1330);
  top(look, 'Pick a look', '4 OF 4');
  text(look, 'Supporting text', 26, 201, 338, 35, 'Same ride. Your way of telling it.', 14, C.gray);
  const lookPreview = frame(look, 'Selected look preview', 85, 257, 220, 317, C.panel, 16);
  landscape(lookPreview, 0, 0, 220, 317);
  rect(lookPreview, 'Data panel', 13, 213, 194, 89, '#0c1512d9', 10);
  text(lookPreview, 'Location', 25, 224, 180, 15, 'SUNDAY IN THE HILLS', 8, '#c5cfc7', 650);
  metric(lookPreview, 25, 248, '32.6', 'KM/H', 80, 28);
  metric(lookPreview, 126, 251, '842', 'ELEVATION · M', 80, 23);
  const looks = [['Telemetry', '#261b15'], ['Minimal', C.panel], ['Route', C.panel]];
  looks.forEach(([title, fill], i) => {
    const card = frame(look, `${title} look`, 26 + i * 116, 600, 106, 80, fill, 12, i === 0 ? { borderColor: C.orange, borderWidth: 1.5 } : {});
    rect(card, 'Look preview line', 14, 17, 78, 5, i === 0 ? C.orange : '#676e76', 2);
    rect(card, 'Look preview line', 14, 29, i === 1 ? 39 : 53, 3, '#858b93', 2);
    text(card, 'Look name', 12, 53, 82, 17, title, 11, C.white, 550, 'center');
  });
  button(look, 'Open editor', 727);

  section('Editor and export', 'Basic account · Switch the plan in Tweaks', 2304);

  const editor = screen('14 Editor', 0, 2460);
  icon(editor, 'back', 23, 75, 22, C.gray);
  text(editor, 'Editor title', 58, 76, 230, 24, 'Sunday in the hills', 16, C.white, 650);
  const exportButton = frame(editor, 'Export', 293, 69, 72, 33, C.orange, 18);
  text(exportButton, 'Button label', 10, 9, 52, 17, 'Export', 11, C.white, 650, 'center');
  const editorPreview = frame(editor, 'Portrait video preview', 82, 132, 226, 363, C.panel, 12);
  landscape(editorPreview, 0, 0, 226, 363);
  rect(editorPreview, 'Telemetry overlay', 13, 257, 200, 91, '#0c1512dd', 10);
  text(editorPreview, 'Ride title overlay', 25, 269, 180, 14, 'SUNDAY IN THE HILLS', 8, '#c5cfc7', 650);
  metric(editorPreview, 25, 294, '32.6', 'KM/H', 80, 28);
  metric(editorPreview, 130, 297, '842', 'ELEVATION · M', 78, 23);
  text(editor, 'Current timecode', 26, 520, 110, 21, '00:12.4', 12, C.white, 600);
  icon(editor, 'play', 185, 516, 22);
  text(editor, 'Total duration', 269, 520, 95, 21, '00:32.0', 12, C.gray, 500, 'right');
  const videoTrack = frame(editor, 'Video timeline', 26, 564, 338, 63, C.panel, 8, { borderColor: C.orange, borderWidth: 2 });
  for (let i = 0; i < 6; i++) landscape(videoTrack, 3 + i * 55, 3, 54, 55, i % 2);
  rect(editor, 'Playhead', 166, 554, 2, 145, '#f9f9f9', 1);
  ellipse(editor, 'Playhead handle', 162, 550, 10, 10, '#f9f9f9');
  const dataTrack = frame(editor, 'Telemetry track', 26, 642, 338, 35, '#2d251d', 6);
  icon(dataTrack, 'sliders', 11, 10, 14, '#dda276');
  text(dataTrack, 'Track label', 36, 10, 280, 17, 'Telemetry · Speed, elevation, distance', 10, '#e0b18d', 500);
  [['trim', 'Trim'], ['sliders', 'Data'], ['spark', 'Look'], ['volume', 'Audio']].forEach(([kind, label], i) => {
    icon(editor, kind, 54 + i * 86, 734, 23, i === 1 ? C.orange : C.gray);
    text(editor, `${label} tool`, 29 + i * 86, 770, 73, 17, label, 10, i === 1 ? C.orange : C.gray, 500, 'center');
  });

  const exportScreen = screen('15 Export', 1, 2460);
  top(exportScreen, 'Make it share-ready.');
  text(exportScreen, 'Supporting text', 26, 202, 338, 36, 'One last look before it leaves the camera roll.', 12, C.gray);
  const exportPreview = frame(exportScreen, 'Export preview', 26, 264, 338, 184, C.panel, 14);
  landscape(exportPreview, 0, 0, 338, 184);
  pill(exportPreview, '00:32', 271, 142, 50, '#0b0c0ebd', '#fff');
  const settings = frame(exportScreen, 'Export settings', 26, 477, 338, 181, C.panel, 15);
  [['Resolution', '1080p'], ['Frame rate', '30 fps'], ['Format', 'Vertical · 9:16']].forEach(([label, detail], i) => {
    text(settings, label, 17, 22 + i * 59, 140, 23, label, 13, C.gray, 450);
    text(settings, `${label} value`, 160, 22 + i * 59, 143, 23, detail, 13, C.white, 550, 'right');
    icon(settings, 'chevron', 310, 26 + i * 59, 12, C.muted);
    if (i < 2) line(settings, 17, 59 + i * 59, 304);
  });
  text(exportScreen, 'Estimated file size', 26, 681, 338, 18, 'Estimated size: 48 MB · No watermark', 11, C.muted, 400, 'center');
  button(exportScreen, 'Export reel', 727);

  const ready = screen('16 Ready', 2, 2460);
  icon(ready, 'close', 338, 74, 20, C.gray);
  ellipse(ready, 'Success background', 164, 151, 62, 62, '#332216');
  icon(ready, 'check', 182, 168, 27, C.orange);
  text(ready, 'Success heading', 26, 242, 338, 49, 'That’s a wrap.', 34, C.white, 700, 'center');
  text(ready, 'Success description', 26, 303, 338, 43, 'Your reel is ready for its next adventure.', 14, C.gray, 400, 'center');
  const readyPreview = frame(ready, 'Finished reel', 93, 371, 204, 232, C.panel, 16);
  landscape(readyPreview, 0, 0, 204, 232);
  rect(readyPreview, 'Finished reel data', 12, 158, 180, 60, '#0c1512db', 8);
  text(readyPreview, 'Finished reel speed', 25, 168, 100, 31, '32.6', 26, C.white, 700);
  text(readyPreview, 'Finished reel unit', 26, 200, 110, 12, 'KM/H', 8, C.gray, 600);
  pill(ready, '1080P · 00:32 · 48 MB', 100, 626, 190);
  const save = button(ready, 'Save to camera roll', 692);
  icon(save, 'download', 58, 17, 17);
  button(ready, 'Back to your reels', 757, 'outline');

  const now = new Date().toISOString();
  const boardId = id === 'board-main' ? 'board-main-2' : 'board-main';
  return {
    id, name,
    description: 'An editable mobile experience for turning activity data and adventure footage into share-ready reels.',
    revision: 1,
    boards: [{ id: boardId, name: 'Main board', createdAt: now, updatedAt: now }],
    pages: [{ id: 'page-1', boardId, name: 'Page 1', nodes, viewport: { x: 40, y: 60, zoom: 0.31 } }],
    threads: [],
    tokens: { ...defaultTokens },
    designSystem: defaultDesignSystem(defaultTokens),
    createdAt: now,
    updatedAt: now,
  };
}
