// tslint:disable: no-console

/**
 * Only keeps "contractName", "abi", "sourcePath", "compiler", "networks",
 * "schemaVersion" and "updatedAt".
 */

const glob = require("glob");
const fs = require("fs");

const networks = ["testnet", "devnet", "localnet"];

const path = require("path");
const dirname = path.dirname(__filename);

for (const network of networks) {
    const directory = path.join(dirname, `./${network}/*.json`);
    glob(directory, (globErr, files) => { // read the folder or folders if you want: example json/**/*.json
        if (globErr) {
            console.log(`error while reading the files in ${directory}`, globErr);
        }
        files.forEach((file) => {
            fs.readFile(file, "utf8", (readErr, data) => { // Read each file
                if (readErr) {
                    console.log(`error while reading the contents of ${file}`, readErr);
                }
                var obj = JSON.parse(data);
                const newObj = {
                    abi: obj.abi,
                    compiler: obj.compiler,
                    contractName: obj.contractName,
                    networks: obj.networks,
                    schemaVersion: obj.schemaVersion,
                    sourcePath: obj.sourcePath,
                };
                const newData = JSON.stringify(newObj, null, "  ");

                if (data !== newData) {
                    fs.writeFile(file, JSON.stringify(newObj, null, "  "), (writeErr) => {
                        if (writeErr) {
                            return console.log(writeErr);
                        }
                        console.log(` Updated \x1b[33m${file}\x1b[0m.`);
                    });
                }
            });
        });
    });
}
