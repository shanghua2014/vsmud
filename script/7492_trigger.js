// 定义默认触发器对象
const defaultTrigger = {
	name: 'sys',
	group: 'sys',
	enable: true,
	onSuccess: () => {
		return '';
	},
	cmd: 'null',
};

const a = require('./abc.js');

module.exports = {
	Triggers: () => {
		const tr = [];

		// 合并默认值和自定义值添加触发器
		tr.push({
			...defaultTrigger,
			reg: '你「哈哈」大笑几声。',
			onSuccess: () => {
				a.abc();
				return 'hehe';
			},
		});

		tr.push({
			...defaultTrigger,
			name: '触发成功执行命令',
			reg: '触发器 action',
			group: '触发器 group',
			cmd: 'look',
		});

		return tr;
	},
};
