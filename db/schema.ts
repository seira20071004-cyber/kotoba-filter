import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const requestUsage=sqliteTable('request_usage',{userId:text('user_id').notNull(),day:text('day').notNull(),count:integer('count').notNull() },t=>[primaryKey({columns:[t.userId,t.day]})]);
