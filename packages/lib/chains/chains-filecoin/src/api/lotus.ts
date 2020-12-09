export const _ = null;

// import FilecoinClient from "@glif/filecoin-rpc-client";

// import { FilNetwork, FilTransaction } from "@renproject/chains-filecoin/src/deposit";

// export const fetchDeposits = async (
//     client: FilecoinClient,
//     address: string,
//     paramsFilterBase64: string | undefined = undefined,
//     network: FilNetwork,
// ): Promise<FilTransaction[]> => {
//     // const network = address.slice(0, 1) === "t" ? "testnet" : "mainnet";

//     const chainHead = await client.request("ChainHead");
//     const height = chainHead.Height;

//     const latestTXs = await client.request(
//         "StateListMessages",
//         {
//             Version: 0,
//             To: address,
//             From: null,
//             Nonce: 0,
//             Value: "0",
//             GasPrice: "0",
//             GasLimit: 0,
//             Method: 0,
//             Params: null,
//         },
//         [],
//         height - 100,
//     );

//     if (latestTXs) {
//         for (const cid of latestTXs) {
//             try {
//                 const transactionDetails = await client.request(
//                     "ChainGetMessage",
//                     cid,
//                 );

//                 if (network === "testnet") {
//                     transactionDetails.To = transactionDetails.To.replace(
//                         /^f/,
//                         "t",
//                     );
//                     transactionDetails.From = transactionDetails.From.replace(
//                         /^f/,
//                         "t",
//                     );
//                 }
//                 const tx: FilTransaction = {
//                     cid: cid["/"],
//                     amount: transactionDetails.Value,
//                     params: transactionDetails.Params,
//                     nonce: transactionDetails.Nonce,
//                     confirmations: transactionDetails.
//                     // to: transactionDetails.To,
//                     // blocknumber: latestHeight,
//                 };
//             } catch (error) {
//                 console.error(error);
//             }
//         }
//     }

//     return messages
//         .map(
//             (message): FilTransaction => {
//                 return {
//                     cid: message.cid,
//                     // to: message.to,
//                     amount: message.amount,
//                     params: message.params,
//                     confirmations: height ? height - height + 1 : 0,
//                     nonce: message.nonce,
//                 };
//             },
//         )
//         .filter(
//             (message) =>
//                 !paramsFilterBase64 || message.params === paramsFilterBase64,
//         );
// };

// export const fetchMessage = async (
//     cid: string,
//     network: FilNetwork,
// ): Promise<FilTransaction> => {
//     // TODO: Add network parameter.
//     const query = `{
//         messages: FilecoinTransactions(cid: "${cid}") {
//             cid
//             params
//             to
//             nonce
//             blocknumber
//             amount
//         }

//         height: NetworkHeight(chain: "Filecoin", network: "${network}")
//     }`;

//     const response = (
//         await Axios.post<{
//             errors?: Array<{ message: string }>;
//             data: {
//                 messages: Array<{
//                     cid: string;
//                     params: string;
//                     to: string;
//                     nonce: number;
//                     blocknumber: number;
//                     amount: string;
//                 }>;
//                 height: number;
//             };
//         }>(INDEXER_URL, { query })
//     ).data;

//     if (response.errors && response.errors.length) {
//         throw new Error(
//             `Unable to fetch Filecoin messages: ${response.errors[0].message}`,
//         );
//     }

//     const { messages, height } = response.data;

//     if (messages.length === 0) {
//         throw new Error(
//             `Error fetching Filecoin transaction: message not found.`,
//         );
//     }

//     if (messages.length > 1) {
//         console.warn(
//             `More than 1 Filecoin transaction found with the same transaction ID.`,
//         );
//     }

//     const message = messages[0];

//     return {
//         cid: message.cid,
//         // to: message.to,
//         amount: message.amount,
//         params: message.params,
//         confirmations: message.blocknumber
//             ? height - message.blocknumber + 1
//             : 0,
//         nonce: message.nonce,
//     };
// };
