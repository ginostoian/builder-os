import next from "eslint-config-next";

const config = [...next, { ignores: ["project/**", ".next/**"] }];

export default config;
