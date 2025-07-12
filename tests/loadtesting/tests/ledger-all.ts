// @ts-ignore
import {Options} from 'k6/options';
import testInfo from "./../src/ledger/infos-test";
import testAccounts from "./../src/ledger/accounts-test";
import testTransactions from "./../src/ledger/transactions-test";
import testWriteTransactions from "./../src/ledger/write-transactions-test";

export let options: Options = {
    vus: 10,
    duration: '1m',
};

export default () => {
    testInfo();
    testAccounts();
    testTransactions();
    testWriteTransactions();
};
