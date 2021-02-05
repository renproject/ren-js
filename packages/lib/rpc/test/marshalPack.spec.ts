import { expect } from "earljs";
import { describe, it } from "mocha";
import { Ox } from "@renproject/utils";

import { marshalTypedPackValue } from "../src/v2/pack/marshal";
import { PackPrimitive, TypedPackValue } from "../src/v2/pack/pack";

describe("Pack", () => {
    it("Marshal pack value", () => {
        const expected =
            "0x140000000400000006616d6f756e740700000005746f6b656e0a00000002746f0a000000056e6f6e63650ccb6beefca4aded539a56f136a7ff24a2901fe6627233b8bf8d7d7f69c8737fc300000144f2b580a8f0ac80a2f294b3a9f1afaf86f18597b6f38186a3f1ada7aff185bc94f2908ba6f1a7afb3e4aaa2f481b0b1f29986a5f3aea7b1f488a3a1f396958aebad83f283ad81f0b2a8b5f193ada4f2b0b1b0f3a9b692f2a4a9bef2a9acb3f39d8abef189aab0f2878585f38aa1a9f18b97adf09d978cf29caabff3b099b9f2a494a5f39294a9f2b58299f393ba94f388979ae3b185f2b58fa9f294bfa2f390aa9df3ba84a1f29db093f0a1a7a4f18f939ef1a59d9df48fb0aaeb81ade49fb8e88aaaf0968aa2f1a488aaf381b6a8f0a4bdbaf3bf99aaf2a98e97f29eb486f2b294a2f1a98c86f1bab29be7babaf399bf93f285bf89f3b08996f3839b8df2b8af9af392adb6f0b58cabf2a484b3f0b6ac8af0a4808ff0aeb3a0f282949ceebfa9f2b5b48af3bb9da7f286819bf1b9b1baf39bbeb8f0baa484f18f8b8af398a691f2a39fa700000168f38285acf2bb93b7f0a0b195f0b3bfb6f1b980a7f2b4b28bf1b785b0f2a2afbef3baa99bf0b5b59cf187a6a1f3acb58ff3a5899df38cb3baf2b78f94f18bb599f29d908cf38290a3f1b2a8aef0b39785ecb1bbf0a5bb86eeac81f3a4aa8ff4858299f3bc80bef2ae80a3f1a396a8f28ca18bf3b794b5f38faaa3f0b181a5f3928a8bf2989cbaf2a9919ef296a8b5f39cb0aaf09eb5abf098abb0f2a382b1f1b3b1a8f1acb5aaf1b2bb98efb1bbf2b580adf1849facf39d8cbcf19bb5b9f09a8aa9f39f88bbe5b2b3f29c80a3f39fb596f1a7af97f48f87a6f0bb91b3f398a9a2f28d82a6f0a5a394f2999e93f0a5bc92f3a48b8af3bda295f482adb6f3a9a3a5f3bc89b5f195a1baf2a18db4f2969b9bf1a5bcb1f2b1b19bf39ea5abef9e9ff1b68d91f0b895b9f18db590f3b691baf399a9abe8afbbf094a9b2e98f8cf295b0b8f18eafb0f2868cbbf2a48e9bf3bdadaef394a9b8f1acb3a3f4878a8de7b0acf3b59495f48a8ba6df46480fdfbf78dfc7f1fea5dfd3a5b4668f5c48e16e086baf28852beb01a9d4";

        const packValue: TypedPackValue = {
            t: {
                struct: [
                    { amount: PackPrimitive.U256 },
                    { token: PackPrimitive.Str },
                    { to: PackPrimitive.Str },
                    { nonce: PackPrimitive.Bytes32 },
                ],
            },
            v: {
                amount:
                    "92010210325214225514040705701652972196351460568772244563366741439829733769155",
                nonce: "30ZID9-_eN_H8f6l39OltGaPXEjhbghrryiFK-sBqdQ",
                to:
                    "󂅬򻓷𠱕𳿶񹀧򴲋񷅰򢯾󺩛𵵜񇦡󬵏󥉝󌳺򷏔񋵙򝐌󂐣񲨮𳗅챻𥻆󤪏􅂙󼀾򮀣񣖨򌡋󷔵󏪣𱁥󒊋򘜺򩑞򖨵󜰪𞵫𘫰򣂱񳱨񬵪񲻘ﱻ򵀭񄟬󝌼񛵹𚊩󟈻岳򜀣󟵖񧯗􏇦𻑳󘩢򍂦𥣔򙞓𥼒󤋊󽢕􂭶󩣥󼉵񕡺򡍴򖛛񥼱򱱛󞥫񶍑𸕹񍵐󶑺󙩫读𔩲鏌򕰸񎯰򆌻򤎛󽭮󔩸񬳣􇊍簬󵔕􊋦",
                token:
                    "򵀨𬀢򔳩񯯆񅗶󁆣񭧯񅼔򐋦񧯳䪢􁰱򙆥󮧱􈣡󖕊뭃򃭁𲨵񓭤򰱰󩶒򤩾򩬳󝊾񉪰򇅅󊡩񋗭𝗌򜪿󰙹򤔥󒔩򵂙󓺔󈗚㱅򵏩򔿢󐪝󺄡򝰓𡧤񏓞񥝝􏰪끭䟸芪𖊢񤈪󁶨𤽺󿙪򩎗򞴆򲔢񩌆񺲛纺󙿓򅿉󰉖󃛍򸯚󒭶𵌫򤄳𶬊𤀏𮳠򂔜򵴊󻝧򆁛񹱺󛾸𺤄񏋊󘦑򣟧",
            },
        };

        // const data = `0000000130000000104254432f66726f6d457468657265756d` + expected;
        // const hash = "c4e423c339ffb1c1bd37b6493a4f209391fb498466bb257fc565ba904804af5a";

        expect(Ox(marshalTypedPackValue(packValue))).toEqual(expected);
    });
});
