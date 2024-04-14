import {sportsMap} from './maps.mjs';

const CONNECTION = new solanaWeb3.Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new solanaWeb3.PublicKey('9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn');
const FILTER_FORM = document.getElementById('filters');
const BETS_TABLE = document.getElementById('betsTable');
const TABLE_COLS = [
    'sport', 'league', 'event', 'period', 'mkt', 'player',
    'stake0', 'stake1', 'wallet0', 'wallet1', 'rent_payer',
    'is_free_bet', 'placed_at', 'to_aggregate', 'account'
];


init();


// Event listeners *********************************

FILTER_FORM.addEventListener('submit', async e => {
    e.preventDefault();
    clearTable();

    const filters = [];
    const sport = parseInt(FILTER_FORM.sportFilter.value);
    const league = parseInt(FILTER_FORM.leagueFilter.value);
    const event = parseInt(FILTER_FORM.eventFilter.value);
    const mkt = parseInt(FILTER_FORM.mktFilter.value);
    const isFree = parseInt(FILTER_FORM.isFreeFilter.value);
    const isAgg = parseInt(FILTER_FORM.isAggregateFilter.value);

    if (!isNaN(sport)) {
        filters.push({memcmp: {
            bytes: Base58.encode(new Uint8Array([sport])),
            offset: 0
        }});
    }

    if (!isNaN(league)) {
        const bytes = encodeNumForFilter(league, 4);
        filters.push({memcmp: { bytes, offset: 1 }});
    }

    if (!isNaN(event)) {
        const bytes = encodeNumForFilter(event, 8);
        filters.push({memcmp: { bytes, offset: 5 }});
    }

    if (!isNaN(mkt)) {
        const bytes = encodeNumForFilter(mkt, 2);
        filters.push({memcmp: { bytes, offset: 14 }});
    }

    if (!isNaN(isFree)) {
        filters.push({memcmp: {
            bytes: Base58.encode(new Uint8Array([isFree])),
            offset: 132
        }});
    }

    if (!isNaN(isAgg)) {
        filters.push({memcmp: {
            bytes: Base58.encode(new Uint8Array([isAgg])),
            offset: 141
        }});
    }

    displayBets(await fetchBets(filters));
});


// Functions ***************************************

async function init() {
    initSportFilter();
    initTable();
    displayBets(await fetchBets());
}

function initSportFilter() {
    const frag = new DocumentFragment();
    const select = FILTER_FORM.sportFilter;

    for (const [name, id] of sportsMap.entries()) {
        const option = document.createElement('option');
        option.textContent = name;
        option.value = id;
        frag.appendChild(option);
    }

    select.appendChild(frag);
}

function initTable() {
    const tr = document.createElement('tr');

    for (const column of TABLE_COLS) {
        const th = document.createElement('th');
        th.textContent = column;
        tr.appendChild(th);
    }

    BETS_TABLE.appendChild(tr);
}

function clearTable() {
    const trs = BETS_TABLE.getElementsByTagName('tr');
    let i = trs.length;

    while (--i) {
        const tr = trs[i];
        tr.parentElement.removeChild(tr);
    }
}

function fetchBets(filters) {
    return CONNECTION.getProgramAccounts(PROGRAM_ID, {filters});
}

function displayBets(bets) {
    const frag = new DocumentFragment();

    for (const {account, pubkey} of bets) {
        const data = parseAccountData(account.data);

        if (data) {
            data.account = pubkey.toBase58();
            const tr = getRow(data);
            frag.appendChild(tr);
        }
    }

    BETS_TABLE.appendChild(frag);
}

// Account data structure
// pub struct BetAcc {            Offset
//     pub sport: u8,               0
//     pub league: u32,             1
//     pub event: u64,              5
//     pub period: u8,              13
//     pub mkt: u16,                14
//     pub player: u32,             16
//     pub stake0: u64,             20
//     pub stake1: u64,             28
//     pub wallet0: [u8; 32],       36
//     pub wallet1: [u8; 32],       68
//     pub rent_payer: [u8; 32],    100
//     pub is_free_bet: bool,       132
//     pub placed_at: u64,          133
//     pub to_aggregate: bool,      141
// }

function parseAccountData(data) {
    if (data.byteLength < 141) return false;

    const dataView = new DataView(data.buffer);

    return {
               sport: dataView.getUint8(0),
              league: dataView.getUint32(1, true),
               event: dataView.getBigUint64(5, true),
              period: dataView.getUint8(13),
                 mkt: dataView.getUint16(14, true),
              player: parsePlayer(data.subarray(16, 20)),
              stake0: parseStake(dataView.getBigUint64(20, true)),
              stake1: parseStake(dataView.getBigUint64(28, true)),
             wallet0: new solanaWeb3.PublicKey(data.subarray(36, 68)).toBase58(),
             wallet1: new solanaWeb3.PublicKey(data.subarray(68, 100)).toBase58(), 
          rent_payer: new solanaWeb3.PublicKey(data.subarray(100, 132)).toBase58(),
         is_free_bet: dataView.getUint8(132) === 1,
           placed_at: parseDate(dataView.getBigUint64(133, true)),
        to_aggregate: data.byteLength === 142
    };
}

function encodeNumForFilter(num, size) {
    const buffer = new ArrayBuffer(size);
    const dataView = new DataView(buffer);
    const map = {
        2: 'setUint16',
        4: 'setUint32',
        8: 'setBigUint64'
    };
    const method = map[size];

    dataView[method](0, size === 8 ? BigInt(num) : num, true);
    return Base58.encode(new Uint8Array(buffer));
}

function parsePlayer(buff) {
    let player = [];

    for (let i = 0; i < 4; ++i) {
        if (buff[i]) {
            player.push(buff[i]);
            if (!i) player.push(46); // 46 is the char code for ".";
        }
    }

    return player.length ? new TextDecoder().decode(new Uint8Array(player)) : '';
}

function parseStake(stake) {
    return parseInt(stake) / 1e6; // 'parseInt' is needed because 'stake' is BigInt.
}

function parseDate(seconds) {
    const millSec = parseInt(seconds) * 1000; // 'parseInt' is needed because 'seconds' is BigInt.
    const date = new Date(millSec).toString().split(' ');

    // date == [Sun, Apr, 14, 2024, 13:21:12, GMT+0530, (India, Standard, Time)]
    return `${date[1]} ${date[2]}, ${date[4]}`;
}

function getRow(accountData) {
    const tr = document.createElement('tr');

    for (const column of TABLE_COLS) {
        const td = document.createElement('td');
        const content = accountData[column];

        if (column === 'account') {
            const button = document.createElement('button');
            button.textContent = content;
            button.addEventListener('click', clickToCopy);
            td.appendChild(button);
        } else if (column === 'is_free_bet' || column === 'to_aggregate') {
            if (content) td.textContent = '✔';
        } else {
            td.textContent = content;
        }
        
        tr.appendChild(td);
    }

    return tr;
}

function clickToCopy() {
    const text = this.textContent;
    navigator.clipboard.writeText(text);
}
