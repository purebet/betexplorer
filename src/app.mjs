import {sportsMap} from './maps.mjs';

const CONNECTION = new solanaWeb3.Connection('https://api.devnet.solana.com');
const PROGRAM_ID = new solanaWeb3.PublicKey('9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn');
const BETS_TABLE = document.getElementById('betsTable');
const FILTERS = new Map();
const TABLE_COLS = [
    'sport', 'league', 'event', 'period', 'mkt', 'player',
    'stake0', 'stake1', 'wallet0', 'wallet1', 'rent_payer',
    'is_free_bet', 'placed_at', 'to_aggregate'
];


init();


// Event listeners *********************************

document.getElementById('filterBets').addEventListener('click', async () => {
    clearTable();
    displayBets(await fetchBets());
});


// Functions ***************************************

async function init() {
    initSportFilter();
    initTable();
    displayBets(await fetchBets());
}

function initSportFilter() {
    const frag = new DocumentFragment();
    const select = document.getElementById('sportFilter');

    for (const [name, id] of sportsMap.entries()) {
        const option = document.createElement('option');
        option.textContent = name;
        option.value = id;
        frag.appendChild(option);
    }

    select.appendChild(frag);

    select.addEventListener('change', function() {
        const sport = parseInt(this.value);

        if (isNaN(sport)) {
            FILTERS.delete('sport');
            return;
        }

        FILTERS.set('sport', {
            memcmp: {
                bytes: Base58.encode(new Uint8Array([sport])),
                offset: 0
            }
        });
    });
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

function fetchBets() {
    const filters = Array.from(FILTERS.values());
    return CONNECTION.getProgramAccounts(PROGRAM_ID, {filters});
}

async function displayBets(bets) {
    const frag = new DocumentFragment();
    const arr = bets.map(({account}) => parseAccountData(account.data));
    const accountDatas = await Promise.all(arr);

    for (const data of accountDatas) {
        if (data) {
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

async function parseAccountData(data) {
    if (data.byteLength < 141) return false;

    const dataView = new DataView(data.buffer);

    return {
               sport: dataView.getUint8(0),
              league: dataView.getUint32(1, true),
               event: dataView.getBigUint64(5, true),
              period: dataView.getUint8(13),
                 mkt: dataView.getUint16(14, true),
              player: dataView.getUint32(16, true),
              stake0: dataView.getBigUint64(20, true),
              stake1: dataView.getBigUint64(28, true),
             wallet0: new solanaWeb3.PublicKey(data.subarray(36, 68)).toBase58(),
             wallet1: new solanaWeb3.PublicKey(data.subarray(68, 100)).toBase58(), 
          rent_payer: new solanaWeb3.PublicKey(data.subarray(100, 132)).toBase58(),
         is_free_bet: dataView.getUint8(132) === 1,
           placed_at: dataView.getBigUint64(133, true),
        to_aggregate: data.byteLength === 142
    };
}

function getRow(accountData) {
    const tr = document.createElement('tr');

    for (const column of TABLE_COLS) {
        const td = document.createElement('td');
        td.textContent = accountData[column];
        tr.appendChild(td);
    }

    return tr;
}
