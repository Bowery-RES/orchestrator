function banner() {
  if (process.env.SILENT) return;

  let banner = `
   ██████      ██████       ██████     ██   ██     ███████     ███████     ████████     ██████       █████      ████████      ██████      ██████  
  ██    ██     ██   ██     ██          ██   ██     ██          ██             ██        ██   ██     ██   ██        ██        ██    ██     ██   ██ 
  ██    ██     ██████      ██          ███████     █████       ███████        ██        ██████      ███████        ██        ██    ██     ██████  
  ██    ██     ██   ██     ██          ██   ██     ██               ██        ██        ██   ██     ██   ██        ██        ██    ██     ██   ██ 
   ██████      ██   ██      ██████     ██   ██     ███████     ███████        ██        ██   ██     ██   ██        ██         ██████      ██   ██ 
                                                                                                                             v 2.1.0 @0xIslamTaha                                                                                                                                                                                                                                                                                
`;

  console.log(banner);
}


function step(msg, newLine=false) {
  if (process.env.SILENT) return;

  let message;
  if (newLine) {
    message = `\n[*] ${msg}`; 
  } else {
    message = `[*] ${msg}`;
  }
  console.log(message);
}

function subStep(subStep){
  if (process.env.SILENT) return;

  let message = `[-] ${subStep}`;
    console.log(message);
}

function time(message) {
  if (process.env.SILENT) return;

  console.time(message);
}

function timeEnd(message) {
  if (process.env.SILENT) return;

  console.timeEnd(message);
}

function warn(message) {
  if (process.env.SILENT) return;

  console.warn(message);
}

export { banner, step, subStep, time, timeEnd, warn };
