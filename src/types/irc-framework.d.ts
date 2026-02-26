declare module "irc-framework" {
  export class Client {
    constructor()
    connect(options: any): void
    join(channel: string, key?: string): void
    part(channel: string, message?: string): void
    quit(message?: string): void
    say(target: string, message: string): void
    notice(target: string, message: string): void
    action(target: string, message: string): void
    raw(rawLine: string): void
    changeNick(nick: string): void
    setTopic(channel: string, topic: string): void
    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler: (...args: any[]) => void): void
    user: {
      nick: string
      username: string
      gecos: string
    }
  }
}
