import { CompletionString, XmlTagCollection } from "./types";

describe("XmlTagCollection", () => {

    it("return empty string when data missing", () => {

        const xtc = new XmlTagCollection();
        xtc.setNsMap("a", "b");

        expect(xtc.fixNs(new CompletionString(""), new Map<string, string>()))
            .toEqual(new CompletionString(""));
    });
});