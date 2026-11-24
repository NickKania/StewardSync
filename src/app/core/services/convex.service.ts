import { assertInInjectionContext, DestroyRef, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { appRuntimeConfig } from '@core/config/runtime-config';
import { api } from '@convex/_generated/api';
import { environment } from '../../../environments/environment';
import { ConvexCustomLogger } from './convex-logger';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({
  providedIn: 'root'
})
export class ConvexService implements OnDestroy {
  private client: ConvexClient;

  constructor(private configService: RuntimeConfigService) {
    const convexUrl = appRuntimeConfig.convexUrl;

    if (!environment.production) {
      console.log('[ConvexService] initializing client', {
        convexUrl,
      });
    }
    this.client = new ConvexClient(convexUrl, {
      logger: new ConvexCustomLogger()
    });
  }

  get api(): typeof api {
    return api;
  }

  async query<T extends FunctionReference<'query'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return this.client.query(func, args);
  }

  async mutation<T extends FunctionReference<'mutation'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return this.client.mutation(func, args);
  }

  async action<T extends FunctionReference<'action'>>(
    func: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return this.client.action(func, args);
  }

  createReactiveQuery<T extends FunctionReference<'query'>>(
    func: T,
    args: FunctionArgs<T>,
    onData?: (data: FunctionReturnType<T>) => void,
    destroyRef = this.getCurrentDestroyRef()
  ) {
    const data = signal<FunctionReturnType<T> | undefined>(undefined);
    const loading = signal(true);
    const error = signal<Error | null>(null);

    const stop = this.client.onUpdate(
      func,
      args,
      (result) => {
        data.set(result);
        loading.set(false);
        error.set(null);
        onData?.(result);
      },
      (queryError) => {
        error.set(queryError);
        loading.set(false);
      }
    );

    let active = true;
    const unsubscribe = () => {
      if (!active) return;
      active = false;
      stop();
    };
    const unregister = destroyRef?.onDestroy(unsubscribe);

    return {
      data: data.asReadonly(),
      loading: loading.asReadonly(),
      error: error.asReadonly(),
      unsubscribe: () => {
        if (!active) return;
        unregister?.();
        unsubscribe();
      }
    };
  }

  private getCurrentDestroyRef(): DestroyRef | undefined {
    try {
      assertInInjectionContext(this.createReactiveQuery);
    } catch {
      return undefined;
    }
    return inject(DestroyRef);
  }

  ngOnDestroy(): void {
    this.client.close();
  }
}
