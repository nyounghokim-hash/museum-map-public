import { NextResponse } from 'next/server';

export type ApiErrorResponse = {
    code: string;
    message: string;
    details?: any;
};

export function successResponse<T>(data: T, status = 200) {
    return NextResponse.json({ data }, { status });
}

export function errorResponse(code: string, message: string, status = 400, details?: any) {
    const payload: ApiErrorResponse = { code, message, details };
    return NextResponse.json(payload, { status });
}
