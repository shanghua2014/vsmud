/** @format */

module.exports = {
	Aliases: () => {
		const ti = [];
		ti.push({
			name: "触发成功执行回调",
			reg: "触发语句",
			group: "sys",
			enable: true,
			timer: () => {
				setTimeout(() => {
					console.log("timer1执行回调");
				}, 1000);
			},
		});
		ti.push({
			name: "触发成功执行回调",
			reg: "触发语句",
			group: "sys",
			enable: true,
			timer: () => {
				setTimeout(() => {
					console.log("timer2执行回调");
				}, 1000);
			},
		});
		return ti;
	},
};
