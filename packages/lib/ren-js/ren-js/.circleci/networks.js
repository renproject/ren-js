const testnetFailed = parseInt(process.argv[2]) > 0;
const devnetFailed = parseInt(process.argv[3]) > 0;
const localnetFailed = parseInt(process.argv[4]) > 0;
const totalFailed = testnetFailed + devnetFailed + localnetFailed;

function generateBlock(name, failed) {
    return `
      <testsuite name="${name}" tests="1" failures="${failed ? "1" : "0"}" time="0">
        <testcase name="${name}" time="0" classname="${name}">
            ${failed ? `<failure message="${name} failed!"></failure>` : ""}
        </testcase>
      </testsuite>
    `;
}

const x = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Darknode networks" time="0" tests="2" failures="${totalFailed}">
    ${generateBlock("Testnet", testnetFailed)}
    ${generateBlock("Devnet", devnetFailed)}
    ${generateBlock("Localnet", localnetFailed)}
</testsuites>`;

console.log(x);
