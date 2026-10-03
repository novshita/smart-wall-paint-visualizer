import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Login } from './login';
import { AuthService } from '../../core/auth/auth.service';

describe('Login page', () => {
  const login = vi.fn();

  beforeEach(() => {
    login.mockReset();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
  });

  function setup(returnUrl?: string) {
    const fixture = TestBed.createComponent(Login);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, type, submit };
  }

  it('does not call the API when the form is invalid', () => {
    const { el, submit } = setup();
    submit();
    expect(login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter your email');
  });

  it('logs in and navigates to the safe return URL', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    login.mockReturnValue(of({}));
    const { type, submit } = setup('/profile');
    type('input[type=email]', 'asha@example.com');
    type('input[formcontrolname=password]', 'Paint1234');
    submit();
    expect(login).toHaveBeenCalledWith('asha@example.com', 'Paint1234');
    expect(navigate).toHaveBeenCalledWith('/profile');
  });

  it('shows the server error message', () => {
    login.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Invalid email or password', errors: [] })),
    );
    const { el, type, submit } = setup();
    type('input[type=email]', 'asha@example.com');
    type('input[formcontrolname=password]', 'nope');
    submit();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Invalid email or password');
  });
});
