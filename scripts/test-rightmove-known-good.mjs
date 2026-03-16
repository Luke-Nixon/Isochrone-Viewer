// Verify our HTTP fetch method against three known-good Rightmove URLs.
// These URLs are taken verbatim from test-polyline.mjs — they were confirmed
// working manually in a browser.

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const KNOWN_GOOD_URLS = [
    {
        label: 'URL 1 (small, 10-pt polygon)',
        url: 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22_be%7DHa%60uBjhBiCi%40kmGcN%3F_pA%7C%5B_AzjE%7DD%7Ej%40%3FcA%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
    },
    {
        label: 'URL 2 (medium, 30-pt polygon)',
        url: 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22ki%60%7DHuenBw%7CDl_d%40_jVdzRspFhkSdzHlx%60%40bwPdzRdpIkoFtqF%7DhRqIijp%40%7EeJztAxfIljZnqJngJr%7CJoyCl%7DH_pUt%7E%40gjp%40erLcu%7C%40vhD%7Dyh%40ufNinc%40yqIor%40c%7DEx%7BD_sClw%7D%40m%7CFx%7ETipJxbHr%5EnjZci%40oyC%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
    },
    {
        label: 'URL 3 (large, ~60-pt polygon)',
        url: 'https://www.rightmove.co.uk/property-for-sale/map.html?locationIdentifier=USERDEFINEDAREA%5E%7B%22polylines%22%3A%22qig%7DHmvaEsAjbQzlDzKrA%7E%5CgDrlCcrD%60%5DfDx%7BDbrDhCoIpwDytDbP%7E%5BvfFzlDa%5DgDfn%40qf%40lTquBdP%7CFfpb%40ncAha%40hmChC%60q%40%7BKeLm%7ERxeB%7Di%40pf%40gjBmQssFq%7DBy%7DCtrCqwDlQ%7DgAyk%40c%60E%7DzBslCbeDsjD%7E%5BqpAon%40kkHybCy%7DCbkBglA%7Ex%40ewB_%5C_kF%7BeBqwDksAqG%7Bc%40re%40fDpnB%7Ex%40hjB_y%40ppAg%7E%40%3FhDqpAqf%40cyAy%60A%7BKeLdPus%40duClQ%60bDfD%3F%22%7D&viewType=MAP&numberOfPropertiesPerPage=95',
    },
];

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('='.repeat(72));
console.log('Rightmove fetch reliability test — known-good URLs');
console.log('='.repeat(72));
console.log('Fetch config: redirect=follow, Browser User-Agent');
console.log('');

const results = [];

for (let i = 0; i < KNOWN_GOOD_URLS.length; i++) {
    const { label, url } = KNOWN_GOOD_URLS[i];

    if (i > 0) await delay(1000);

    console.log(`── ${label}`);
    console.log(`   Input URL length: ${url.length} chars`);

    let status, finalUrl, redirected, notFound, error;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-GB,en;q=0.9',
            },
            redirect: 'follow',
        });

        status = res.status;
        finalUrl = res.url;
        redirected = res.redirected;
        notFound = finalUrl.includes('page-not-found');
        error = null;
    } catch (err) {
        status = null;
        finalUrl = null;
        redirected = null;
        notFound = null;
        error = err.message;
    }

    if (error) {
        console.log(`   ERROR: ${error}`);
    } else {
        console.log(`   HTTP status:     ${status}`);
        console.log(`   Redirected:      ${redirected}`);
        console.log(`   Final URL:       ${finalUrl}`);
        console.log(`   page-not-found:  ${notFound}`);
        console.log(`   Verdict:         ${notFound ? '*** REJECTED (page-not-found) ***' : status === 200 ? 'OK (200, no redirect to not-found)' : `UNEXPECTED (${status})`}`);
    }
    console.log('');

    results.push({ label, status, finalUrl, redirected, notFound, error });
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('SUMMARY');
console.log('='.repeat(72));

const allOk = results.every(r => !r.error && r.status === 200 && !r.notFound);
const allFailed = results.every(r => r.error || r.notFound);

for (const r of results) {
    const verdict = r.error
        ? `ERROR: ${r.error.substring(0, 40)}`
        : r.notFound
            ? 'REJECTED (page-not-found)'
            : `OK (HTTP ${r.status})`;
    console.log(`  ${r.label}: ${verdict}`);
}

console.log('');
if (allOk) {
    console.log('CONCLUSION: fetch method is RELIABLE — known-good URLs return 200 OK.');
    console.log('            Previous test results can be trusted.');
} else if (allFailed) {
    console.log('CONCLUSION: fetch method is BROKEN — known-good URLs also get rejected.');
    console.log('            Previous test results are unreliable (false negatives).');
} else {
    console.log('CONCLUSION: MIXED results — method may be unreliable or rate-limited.');
    const okCount = results.filter(r => !r.error && !r.notFound).length;
    console.log(`            ${okCount}/${results.length} known-good URLs returned OK.`);
}

console.log('\nDone.');
