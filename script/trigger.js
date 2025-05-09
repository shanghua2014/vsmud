/** @format */

// 将 ES Module 语法改为 CommonJS 语法
module.exports = {
	Triggers: () => {
		const t = [];
		t.push({
			name: "哈哈",
			reg: "4444",
			group: "sys",
			onSuccess: () => {
				return "hehe";
			},
		});
		t.push({
			name: "触发器 name",
			reg: "触发器 action",
			group: "触发器 group",
			cmd: "look",
		});
		return t;
	},
};
