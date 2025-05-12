/** @format */

module.exports = {
	Triggers: () => {
		const tr = [];
		tr.push({
			name: "名称",
			reg: "你「哈哈」大笑几声。",
			group: "sys",
			enable: true,
			onSuccess: () => {
				return "xixi";
			},
		});
		tr.push({
			name: "触发成功执行命令",
			reg: "触发器 action",
			group: "触发器 group",
			enable: true,
			cmd: "look",
		});
		return tr;
	},
};
