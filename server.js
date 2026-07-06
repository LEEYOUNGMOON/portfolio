const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ══════════════════════════════════
// ★ API 키
// ══════════════════════════════════
const NAVER_CLIENT_ID     = '_Yad4QsiQzVJM9hhIib5';
const NAVER_CLIENT_SECRET = '_KLSN7h07q';
const DART_API_KEY        = 'fd1ce8b20c7d6bfd4987e137c582a2a2100b8f8e';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = 3000;

// ══════════════════════════════════
// 공통 HTTPS GET 함수
// ══════════════════════════════════
function httpsGet(hostname, reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: reqPath,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...headers },
      rejectUnauthorized: false
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('타임아웃')); });
    req.end();
  });
}

// ══════════════════════════════════
// DART 종목코드 → corp_code 매핑
// ══════════════════════════════════
const DART_CORP_MAP = {
  '005930':'00126380','000660':'00164779','373220':'01426955',
  '207940':'00296498','005380':'00164742','000270':'00164956',
  '068270':'00419870','005490':'00124139','051910':'00118795',
  '006400':'00126380','012330':'00164520','105560':'00402498',
  '055550':'00131177','086790':'00499012','035420':'00261764',
  '035720':'00918444','066570':'00108455','028260':'00149655',
  '096770':'00603803','010130':'00010329','012450':'00115641',
  '034020':'00154136','015760':'00067628','017670':'00085265',
  '030200':'00055288','003550':'00108402','034730':'00603803',
  '011170':'00100013','010140':'00101625','000720':'00098485',
  '042700':'00173501','064350':'00215138','272210':'01138745',
  '079550':'00212737','042660':'00306555','003490':'00069061',
  '011200':'00104637','259960':'01165539','251270':'00739709',
  '036570':'00131986','377300':'02358063','009150':'00126516',
  '003670':'00006207','352820':'01585822','138040':'00547583',
  '139480':'00594638','023530':'00050978','004170':'00022703',
  '069960':'00037594','282330':'01166136','007070':'00048465',
  '004370':'00010199','097950':'00131180','271560':'00699267',
  '090430':'00311336','051900':'00052758','267250':'00631863',
  '329180':'01396432','028050':'00104297','006360':'00046966',
  '086280':'00215243','241560':'01067621','009830':'00104215',
  '010950':'00051015','078930':'00050905','001040':'00036451',
  '000150':'00006207','006260':'00048530','004800':'00017524',
  '011790':'00099474','009540':'00099985','010620':'00099866',
  '033780':'00140380','035250':'00026699','326030':'01355455',
  '000810':'00100625','005830':'00036544','001450':'00037202',
  '006800':'00100332','039490':'00236928','016360':'00126517',
  '005940':'00101567','112610':'00525439','267260':'01141507',
  '010120':'00048527','103590':'00380671','454910':'02437725',
  '278470':'01289490','041510':'00261513','035900':'00261052',
  '122870':'00524787','035760':'00244652','000100':'00009737',
  '069620':'00037965','185750':'00421535','128940':'00370770',
  '028300':'00196671','011780':'00100064','298050':'00017524',
  '120110':'00015200','010060':'00010060','000880':'00053690',
  '375500':'02069291','443060':'02411539','323410':'02086829',
  '307950':'01506541','036830':'00194566','071050':'00388494',
  '437730':'02356027','240810':'00988633','247540':'01247461',
  '086520':'00570030','293490':'01606802','263750':'01205478',
  '067310':'00043736','091990':'00634991','039030':'00139759',
  '140860':'00631238','058470':'00021870','403870':'02148793',
  '196170':'00849025','096530':'00425977','328130':'01747461',
  '338220':'01747480','277810':'01207028','214150':'00919897',
  '189300':'00751954','222080':'01036598','074600':'00058344',
  '319660':'01521040','007660':'00046966','095340':'00429072',
  '064760':'00026842','067630':'00634991','225570':'01030801'
};

// ══════════════════════════════════
// 서버
// ══════════════════════════════════
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname  = parsedUrl.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // ── 네이버 뉴스 API ──
  if (pathname === '/api/news') {
    const query   = parsedUrl.query.query   || '';
    const display = parsedUrl.query.display || '10';
    const sort    = parsedUrl.query.sort    || 'date';

    if (!query) {
      res.writeHead(400, {'Content-Type':'application/json;charset=utf-8'});
      res.end(JSON.stringify({error:'query 파라미터 필요'}));
      return;
    }

    console.log(`📰 네이버 뉴스: "${query}" ${display}건`);
    try {
      const result = await httpsGet(
        'openapi.naver.com',
        `/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}&start=1`,
        {
          'X-Naver-Client-Id'    : NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
        }
      );
      console.log(`  ✅ 네이버 응답: ${result.status}`);
      res.writeHead(result.status, {'Content-Type':'application/json;charset=utf-8'});
      res.end(result.body);
    } catch(e) {
      console.error('  ❌ 네이버 오류:', e.message);
      res.writeHead(500, {'Content-Type':'application/json;charset=utf-8'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // ── DART 공시 (종목코드) ──
  if (pathname === '/api/dart') {
    const stockCode = parsedUrl.query.code  || '';
    const count     = parsedUrl.query.count || '15';

    const corpCode = DART_CORP_MAP[stockCode];
    if (!corpCode) {
      res.writeHead(200, {'Content-Type':'application/json;charset=utf-8'});
      res.end(JSON.stringify({status:'000', list:[]}));
      return;
    }

    const today = new Date();
    const sixMonthAgo = new Date();
    sixMonthAgo.setMonth(today.getMonth() - 6);
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');

    console.log(`📋 DART 공시: ${stockCode} → ${corpCode}`);
    try {
      const result = await httpsGet(
        'opendart.fss.or.kr',
        `/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bgn_de=${fmt(sixMonthAgo)}&end_de=${fmt(today)}&page_count=${count}&sort=rcept_no&sort_mth=desc`
      );
      console.log(`  ✅ DART 응답: ${result.status}`);
      res.writeHead(result.status, {'Content-Type':'application/json;charset=utf-8'});
      res.end(result.body);
    } catch(e) {
      console.error('  ❌ DART 오류:', e.message);
      res.writeHead(500, {'Content-Type':'application/json;charset=utf-8'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // ── DART 공시 (회사명 검색) ──
  if (pathname === '/api/dart/search') {
    const name  = parsedUrl.query.name  || '';
    const count = parsedUrl.query.count || '15';

    const today = new Date();
    const sixMonthAgo = new Date();
    sixMonthAgo.setMonth(today.getMonth() - 6);
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');

    console.log(`📋 DART 이름검색: "${name}"`);
    try {
      const result = await httpsGet(
        'opendart.fss.or.kr',
        `/api/list.json?crtfc_key=${DART_API_KEY}&corp_name=${encodeURIComponent(name)}&bgn_de=${fmt(sixMonthAgo)}&end_de=${fmt(today)}&page_count=${count}&sort=rcept_no&sort_mth=desc`
      );
      console.log(`  ✅ DART 이름검색 응답: ${result.status}`);
      res.writeHead(result.status, {'Content-Type':'application/json;charset=utf-8'});
      res.end(result.body);
    } catch(e) {
      console.error('  ❌ DART 오류:', e.message);
      res.writeHead(500, {'Content-Type':'application/json;charset=utf-8'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // ── 정적 파일 서빙 ──
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath);
    const mime = {
      '.html': 'text/html;charset=utf-8',
      '.js'  : 'text/javascript',
      '.css' : 'text/css'
    }[ext] || 'text/plain';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📰 네이버 뉴스: http://localhost:${PORT}/api/news?query=삼성전자`);
  console.log(`📋 DART 공시:   http://localhost:${PORT}/api/dart?code=005930\n`);
});
